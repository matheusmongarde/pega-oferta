import { NextResponse } from "next/server";
import { getConfigOperacao } from "@/lib/db";
import { getDbV3, type Cupom } from "@/lib/db-v3";
import { lerPadraoCupom, resolverLinksLojasComAfiliado } from "@/lib/cupom-padrao-server";

export const dynamic = "force-dynamic";

const WA_URL = (process.env.WHATSAPP_URL || "http://127.0.0.1:4320").replace(/\/+$/, "");

const NOMES_LOJAS: Record<string, string> = {
  amazon: "Amazon",
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
  aliexpress: "AliExpress",
  awin: "Magalu",
  outra: "Oferta Especial",
};

// Trava simples anti-duplo-clique/reenvio (8 segundos por cupom + destino)
const enviosRecentes = new Map<string, number>();

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDbV3();
  const row = db.prepare("SELECT * FROM cupons WHERE id = ?").get(id) as unknown as Cupom | undefined;
  if (!row) {
    return NextResponse.json({ erro: "Cupom nao encontrado." }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    destinos?: string[];
    imagem_base64?: string;
    mensagem_custom?: string;
    link_cupom?: string;
  };

  const destinos = Array.from(
    new Set((body.destinos || []).map((d) => d.trim()).filter(Boolean))
  );
  if (destinos.length === 0) {
    return NextResponse.json(
      { erro: "Escolha pelo menos um grupo de destino para disparar o cupom." },
      { status: 400 }
    );
  }

  const cfg = getConfigOperacao();
  const padrao = lerPadraoCupom();
  const linksResolvidos = resolverLinksLojasComAfiliado(padrao);
  const lojaNome = NOMES_LOJAS[row.loja] || row.loja;
  const linkFinal = (body.link_cupom || linksResolvidos[row.loja] || "").trim();
  const validadeLimpa =
    row.validade && !/detectado automaticamente/i.test(row.validade) ? row.validade.trim() : "";
  const minimoTxt = row.valor_minimo > 0 ? `R$ ${row.valor_minimo.toFixed(0)}` : "";
  const arroba = (cfg.arroba_marca || "").trim();

  const texto =
    body.mensagem_custom?.trim() ||
    padrao.templateMensagem
      .split("\n")
      .map((linha) => {
        if (linha.includes("{link}") && !linkFinal) return null;
        if (linha.includes("{arroba}") && !arroba) return null;
        if (linha.includes("{minimo}") && !minimoTxt) return null;
        if (linha.includes("{validade}") && !validadeLimpa) return null;
        return linha
          .replace(/\{loja\}/gi, lojaNome)
          .replace(/\{codigo\}/gi, row.codigo.toUpperCase())
          .replace(/\{link\}/gi, linkFinal)
          .replace(/\{arroba\}/gi, arroba)
          .replace(/\{minimo\}/gi, minimoTxt)
          .replace(/\{validade\}/gi, validadeLimpa);
      })
      .filter((l): l is string => l !== null)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const agora = Date.now();
  const resultados: { destino: string; ok: boolean; erro?: string; ignorado_duplicado?: boolean }[] = [];

  for (const destino of destinos) {
    const chave = `${row.id}::${destino}`;
    const ultimo = enviosRecentes.get(chave) || 0;
    if (agora - ultimo < 8000) {
      resultados.push({ destino, ok: true, ignorado_duplicado: true });
      continue;
    }
    enviosRecentes.set(chave, agora);

    try {
      const res = await fetch(`${WA_URL}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destino,
          texto,
          ...(body.imagem_base64 ? { imagem_base64: body.imagem_base64 } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
      resultados.push({
        destino,
        ok: Boolean(res.ok && data.ok),
        erro: data.erro,
      });
    } catch (e) {
      enviosRecentes.delete(chave);
      resultados.push({
        destino,
        ok: false,
        erro: e instanceof Error ? e.message : "Falha ao contatar servico WhatsApp.",
      });
    }
  }

  const enviados = resultados.filter((r) => r.ok && !r.ignorado_duplicado).length;
  return NextResponse.json({
    ok: resultados.some((r) => r.ok),
    enviados,
    total: destinos.length,
    resultados,
  });
}

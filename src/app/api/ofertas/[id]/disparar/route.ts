import { NextResponse } from "next/server";
import { gerarId, getDb, type Marca, type Oferta } from "@/lib/db";
import { dispararOferta } from "@/lib/disparador";
import { formatarMensagemOferta } from "@/lib/parser";

export const dynamic = "force-dynamic";

const WA_URL = (process.env.WHATSAPP_URL || "http://127.0.0.1:4320").replace(/\/+$/, "");
const enviosOfertaRecentes = new Map<string, number>();

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    ignorar_travas?: boolean;
    destinos?: string[];
    instancia?: string;
    mensagem_custom?: string;
  };

  const destinos = Array.from(
    new Set((body.destinos || []).map((d) => d.trim()).filter(Boolean))
  );

  // Disparo direto para grupos escolhidos do WhatsApp (com foto do produto)
  if (destinos.length > 0) {
    const db = getDb();
    const oferta = db
      .prepare("SELECT * FROM ofertas WHERE id = ?")
      .get(id) as Oferta | undefined;
    if (!oferta) {
      return NextResponse.json({ ok: false, erro: "Oferta nao encontrada." }, { status: 404 });
    }
    const marca = db
      .prepare("SELECT * FROM marcas WHERE id = ?")
      .get(oferta.marca_id) as Marca | undefined;

    const templatePadrao =
      marca?.template_mensagem ||
      "🔥 *{{titulo}}*\n\n💰 {{bloco_preco}}\n{{bloco_cupom}}\n\n🛒 {{link}}";

    const mensagem =
      body.mensagem_custom?.trim() || formatarMensagemOferta(oferta, templatePadrao);

    const agora = Date.now();
    const resultados: { destino: string; ok: boolean; erro?: string; ignorado_duplicado?: boolean }[] = [];

    for (const destino of destinos) {
      const chave = `${oferta.id}::${destino}`;
      const ultimo = enviosOfertaRecentes.get(chave) || 0;
      if (agora - ultimo < 8000) {
        resultados.push({ destino, ok: true, ignorado_duplicado: true });
        continue;
      }
      enviosOfertaRecentes.set(chave, agora);

      try {
        const res = await fetch(`${WA_URL}/enviar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destino,
            texto: mensagem,
            ...(body.instancia ? { instancia: body.instancia } : {}),
            ...(oferta.imagem_url ? { imagem_url: oferta.imagem_url } : {}),
          }),
        });
        const d = (await res.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
        const ok = Boolean(res.ok && d.ok);
        resultados.push({ destino, ok, erro: d.erro });

        db.prepare(
          "INSERT INTO envios (id, oferta_id, conexao_id, canal, destino, status, detalhe, mensagem, criado_em) VALUES (?, ?, NULL, 'whatsapp_baileys', ?, ?, ?, ?, ?)"
        ).run(
          gerarId("env"),
          oferta.id,
          destino,
          ok ? "enviado" : "erro",
          ok ? "Enviado direto para grupo via WhatsApp QR." : d.erro || "Falha no envio.",
          mensagem,
          new Date().toISOString()
        );
      } catch (e) {
        enviosOfertaRecentes.delete(chave);
        resultados.push({
          destino,
          ok: false,
          erro: e instanceof Error ? e.message : "Falha ao contatar servico WhatsApp.",
        });
      }
    }

    const enviados = resultados.filter((r) => r.ok && !r.ignorado_duplicado).length;
    if (enviados > 0) {
      db.prepare("UPDATE ofertas SET status = 'enviada', enviada_em = ? WHERE id = ?").run(
        new Date().toISOString(),
        oferta.id
      );
    }

    return NextResponse.json({
      ok: resultados.some((r) => r.ok),
      status: enviados > 0 ? "enviado" : "erro",
      enviados,
      total: destinos.length,
      mensagem,
      imagem_url: oferta.imagem_url || "",
      resultados,
    });
  }

  const resultado = await dispararOferta(id, Boolean(body.ignorar_travas));
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 422 });
}

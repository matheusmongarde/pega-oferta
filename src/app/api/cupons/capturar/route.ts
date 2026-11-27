import { NextResponse } from "next/server";
import { registrarCupomAutomatico } from "@/lib/scraper-og";

export const dynamic = "force-dynamic";

const IGNORAR = new Set([
  "HTTPS",
  "HTTP",
  "WWW",
  "COM",
  "BR",
  "CUPOM",
  "CODIGO",
  "DESCONTO",
  "MERCADO",
  "LIVRE",
  "AMAZON",
  "SHOPEE",
  "ALIEXPRESS",
  "MAGALU",
  "KABUM",
  "WHATSAPP",
  "OFERTA",
  "PROMOCAO",
  "FRETE",
  "GRATIS",
]);

function detectarLojaTexto(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes("amazon") || t.includes("amzn")) return "amazon";
  if (t.includes("mercado livre") || t.includes("mercadolivre") || t.includes("meli") || /\bml\b/.test(t))
    return "mercadolivre";
  if (t.includes("shopee") || t.includes("shope.ee")) return "shopee";
  if (t.includes("aliexpress") || /\bali\b/.test(t)) return "aliexpress";
  if (t.includes("magalu") || t.includes("magazine") || t.includes("kabum") || t.includes("casas bahia"))
    return "awin";
  return "outra";
}

function extrairCodigoCupom(texto: string): string | null {
  // Remove URLs antes de procurar codigos para nao confundir pedacos de URL com cupom
  const semUrls = texto.replace(/https?:\/\/\S+/gi, " ");

  const explicito = semUrls.match(
    /(?:cupom|c[oó]digo|use(?:\s+o\s+cupom)?|aplique)[:\s*`"'#-]+([A-Z0-9_-]{3,22})\b/i
  );
  if (explicito?.[1] && !IGNORAR.has(explicito[1].toUpperCase())) {
    return explicito[1].toUpperCase();
  }

  // Palavra em caixa alta com numeros (ex: MELI20, OFF15, TECH100, ML10)
  const alfanum = semUrls.match(/\b([A-Z]{2,}[0-9]{1,}[A-Z0-9]*)\b/);
  if (alfanum?.[1] && !IGNORAR.has(alfanum[1].toUpperCase())) {
    return alfanum[1].toUpperCase();
  }

  // Entre crases ou asteriscos: *DESCONTO* ou `VALE20`
  const destacado = semUrls.match(/[*`]([A-Z0-9]{4,18})[*`]/);
  if (destacado?.[1] && !IGNORAR.has(destacado[1].toUpperCase())) {
    return destacado[1].toUpperCase();
  }

  return null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    texto?: string;
    origem_label?: string;
  };
  const texto = (body.texto || "").trim();
  if (!texto) return NextResponse.json({ ignorado: true }, { status: 400 });

  const codigo = extrairCodigoCupom(texto);
  if (!codigo) {
    return NextResponse.json({ ignorado: true, motivo: "Nenhum codigo de cupom encontrado." });
  }

  const loja = detectarLojaTexto(texto);
  const origem = (body.origem_label || "Grupo WhatsApp").trim();
  const resumo = texto.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim().slice(0, 80);
  registrarCupomAutomatico(codigo, loja, `[${origem}] ${resumo || "Cupom capturado"}`);

  return NextResponse.json({ ok: true, codigo, loja, origem }, { status: 201 });
}

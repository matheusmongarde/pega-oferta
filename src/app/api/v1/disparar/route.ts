import { NextResponse } from "next/server";
import { autenticarApiV1 } from "@/lib/api-tokens";
import { getDb, type Marca, type Oferta } from "@/lib/db";
import { dispararOferta } from "@/lib/disparador";
import { formatarMensagemOferta } from "@/lib/parser";

export const dynamic = "force-dynamic";

const WA_URL = (process.env.WHATSAPP_URL || "http://127.0.0.1:4320").replace(/\/+$/, "");

export async function POST(req: Request) {
  if (!autenticarApiV1(req).ok) {
    return NextResponse.json(
      { erro: "Token de API invalido ou ausente. Envie Authorization: Bearer po_live_..." },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    oferta_id?: string;
    destinos?: string[];
    instancia?: string;
    texto?: string;
    imagem_url?: string;
    ignorar_travas?: boolean;
  };

  // Caso 1: disparo livre de texto/imagem para um ou mais grupos via API/OpenBot
  if (!body.oferta_id && body.texto?.trim() && Array.isArray(body.destinos) && body.destinos.length > 0) {
    const resultados = [];
    for (const destino of body.destinos) {
      const r = await fetch(`${WA_URL}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destino,
          texto: body.texto.trim(),
          ...(body.instancia ? { instancia: body.instancia } : {}),
          ...(body.imagem_url ? { imagem_url: body.imagem_url } : {}),
        }),
      }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : { ok: false, erro: "WhatsApp offline" };
      resultados.push({ destino, ok: Boolean(r?.ok && d.ok), ...d });
    }
    return NextResponse.json({
      ok: resultados.some((x) => x.ok),
      resultados,
    });
  }

  // Caso 2: disparar uma oferta existente por ID
  if (!body.oferta_id) {
    return NextResponse.json(
      { erro: "Informe oferta_id ou (texto + destinos)." },
      { status: 400 }
    );
  }

  if (Array.isArray(body.destinos) && body.destinos.length > 0) {
    const db = getDb();
    const oferta = db.prepare("SELECT * FROM ofertas WHERE id = ?").get(body.oferta_id) as Oferta | undefined;
    if (!oferta) return NextResponse.json({ erro: "Oferta nao encontrada." }, { status: 404 });
    const marca = db.prepare("SELECT * FROM marcas WHERE id = ?").get(oferta.marca_id) as Marca | undefined;
    const msg = formatarMensagemOferta(
      oferta,
      marca?.template_mensagem || "🔥 *{{titulo}}*\n\n💰 {{bloco_preco}}\n{{bloco_cupom}}\n\n🛒 {{link}}"
    );
    const resultados = [];
    for (const destino of body.destinos) {
      const r = await fetch(`${WA_URL}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destino,
          texto: msg,
          ...(body.instancia ? { instancia: body.instancia } : {}),
          ...(oferta.imagem_url ? { imagem_url: oferta.imagem_url } : {}),
        }),
      }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : { ok: false, erro: "WhatsApp offline" };
      resultados.push({ destino, ok: Boolean(r?.ok && d.ok), ...d });
    }
    if (resultados.some((x) => x.ok)) {
      db.prepare("UPDATE ofertas SET status = 'enviada', enviada_em = ? WHERE id = ?").run(
        new Date().toISOString(),
        oferta.id
      );
    }
    return NextResponse.json({ ok: resultados.some((x) => x.ok), mensagem: msg, resultados });
  }

  const res = await dispararOferta(body.oferta_id, Boolean(body.ignorar_travas));
  return NextResponse.json(res, { status: res.ok ? 200 : 422 });
}

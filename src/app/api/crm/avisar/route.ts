import { NextResponse } from "next/server";
import { getDbV3 } from "@/lib/db-v3";

export const dynamic = "force-dynamic";
const WA_URL = (process.env.WHATSAPP_URL || "http://127.0.0.1:4320").replace(/\/+$/, "");

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    contato_id?: string;
    telefone?: string;
    texto?: string;
    imagem_url?: string;
  };

  if (!body.telefone || !body.texto) {
    return NextResponse.json({ erro: "Telefone e texto obrigatorios." }, { status: 400 });
  }

  try {
    const res = await fetch(`${WA_URL}/enviar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destino: body.telefone,
        texto: body.texto,
        imagem_url: body.imagem_url || "",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
    if (!res.ok) {
      return NextResponse.json({ ok: false, erro: data.erro || "Falha no envio via WhatsApp." }, { status: res.status });
    }

    if (body.contato_id) {
      const db = getDbV3();
      db.prepare("UPDATE crm_contatos SET status = 'avisado' WHERE id = ?").run(body.contato_id);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, erro: "Servico local do WhatsApp offline." },
      { status: 503 }
    );
  }
}

import { NextResponse } from "next/server";
import { autenticarApiV1 } from "@/lib/api-tokens";
import { getDbV3 } from "@/lib/db-v3";
import { registrarCupomAutomatico } from "@/lib/scraper-og";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!autenticarApiV1(req).ok) {
    return NextResponse.json(
      { erro: "Token de API invalido ou ausente. Envie Authorization: Bearer po_live_..." },
      { status: 401 }
    );
  }
  const db = getDbV3();
  const cupons = db
    .prepare("SELECT * FROM cupons ORDER BY criado_em DESC LIMIT 50")
    .all();
  return NextResponse.json({ cupons });
}

export async function POST(req: Request) {
  if (!autenticarApiV1(req).ok) {
    return NextResponse.json(
      { erro: "Token de API invalido ou ausente. Envie Authorization: Bearer po_live_..." },
      { status: 401 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as {
    codigo?: string;
    loja?: string;
    descricao?: string;
  };
  if (!body.codigo?.trim()) {
    return NextResponse.json({ erro: "Campo codigo obrigatorio." }, { status: 400 });
  }
  registrarCupomAutomatico(
    body.codigo.trim().toUpperCase(),
    (body.loja || "outra").trim(),
    (body.descricao || "").trim()
  );
  return NextResponse.json({ ok: true, codigo: body.codigo.trim().toUpperCase() }, { status: 201 });
}

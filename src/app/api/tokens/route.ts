import { NextResponse } from "next/server";
import { criarTokenApi, listarTokensApi, revogarTokenApi } from "@/lib/api-tokens";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ tokens: listarTokensApi() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    nome?: string;
    escopos?: string;
  };
  const nome = (body.nome || "").trim() || "OpenBot / IA";
  const escopos = (body.escopos || "ofertas,cupons,disparar,grupos").trim();
  const criado = criarTokenApi(nome, escopos);
  return NextResponse.json({ ok: true, token: criado }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") || "").trim();
  if (!id) {
    return NextResponse.json({ erro: "Informe o id do token." }, { status: 400 });
  }
  const ok = revogarTokenApi(id);
  return NextResponse.json({ ok });
}

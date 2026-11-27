import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { gerarLinkCurtoShopee, salvarCredenciaisShopee, statusShopeeApi } from "@/lib/shopee-api";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await usuarioAtual())) return NextResponse.json({ erro: "Entre no painel." }, { status: 401 });
  return NextResponse.json(statusShopeeApi());
}

/** Salva AppID e Secret e ja testa gerando um link curto de verdade. */
export async function PATCH(req: Request) {
  if (!(await usuarioAtual())) return NextResponse.json({ erro: "Entre no painel." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { app_id?: string; secret?: string };
  salvarCredenciaisShopee(body.app_id || "", body.secret);
  const status = statusShopeeApi();
  if (!status.configurado) return NextResponse.json({ ...status, teste: null });
  const teste = await gerarLinkCurtoShopee("https://shopee.com.br/");
  return NextResponse.json({ ...status, teste });
}

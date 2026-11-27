import { NextResponse } from "next/server";
import { getConfigOperacao, salvarConfigOperacao, type ConfigOperacao } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ config: getConfigOperacao() });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as Partial<ConfigOperacao>;
  const config = salvarConfigOperacao(body);
  return NextResponse.json({ config });
}

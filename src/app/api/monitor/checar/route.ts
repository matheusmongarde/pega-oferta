import { NextResponse } from "next/server";
import { getDbV4 } from "@/lib/db-v4";
import { checarMonitor } from "@/lib/automacao";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: string };

  if (body.id) {
    const res = await checarMonitor(body.id);
    if (!res) return NextResponse.json({ erro: "Monitor nao encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true, resultado: res });
  }

  const db = getDbV4();
  const todos = db
    .prepare("SELECT id FROM monitores_preco WHERE ativo = 1 LIMIT 15")
    .all() as unknown as Array<{ id: string }>;

  const resultados = [];
  for (const m of todos) {
    const r = await checarMonitor(m.id);
    if (r) resultados.push(r);
  }
  return NextResponse.json({ ok: true, checados: resultados.length, resultados });
}
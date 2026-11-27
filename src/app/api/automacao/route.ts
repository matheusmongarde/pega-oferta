import { NextResponse } from "next/server";
import {
  getConfigAutomacao,
  getDbV4,
  salvarConfigAutomacao,
  type AutomacaoLog,
} from "@/lib/db-v4";
import { executarCicloAutomacao } from "@/lib/automacao";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDbV4();
  const config = getConfigAutomacao();
  const logs = db
    .prepare("SELECT * FROM automacao_log ORDER BY criado_em DESC LIMIT 15")
    .all() as unknown as AutomacaoLog[];
  return NextResponse.json({
    config,
    logs: logs.map((l) => ({ ...l })),
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const config = salvarConfigAutomacao({
    ativo: typeof body.ativo === "boolean" ? body.ativo : undefined,
    intervalo_minutos:
      body.intervalo_minutos !== undefined ? Number(body.intervalo_minutos) : undefined,
    disparar_aprovadas:
      typeof body.disparar_aprovadas === "boolean" ? body.disparar_aprovadas : undefined,
    coletar_rss: typeof body.coletar_rss === "boolean" ? body.coletar_rss : undefined,
    checar_monitores:
      typeof body.checar_monitores === "boolean" ? body.checar_monitores : undefined,
  });
  return NextResponse.json({ ok: true, config });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { forcar?: boolean };
  const resultado = await executarCicloAutomacao(body.forcar !== false);
  return NextResponse.json({ ok: true, ...resultado });
}
import { NextResponse } from "next/server";
import { autenticarApiV1 } from "@/lib/api-tokens";
import { getDb } from "@/lib/db";
import { getConfigAutomacao } from "@/lib/db-v4";

export const dynamic = "force-dynamic";

const WA_URL = (process.env.WHATSAPP_URL || "http://127.0.0.1:4320").replace(/\/+$/, "");

export async function GET(req: Request) {
  const auth = autenticarApiV1(req);
  if (!auth.ok) {
    return NextResponse.json(
      { erro: "Token de API invalido ou ausente. Envie Authorization: Bearer po_live_..." },
      { status: 401 }
    );
  }

  const db = getDb();
  const totalOfertas = (db.prepare("SELECT COUNT(*) as total FROM ofertas").get() as { total: number }).total;
  const pendentes = (
    db.prepare("SELECT COUNT(*) as total FROM ofertas WHERE status IN ('nova', 'aprovada')").get() as {
      total: number;
    }
  ).total;
  const automacao = getConfigAutomacao();

  let whatsapp: Record<string, unknown> = { online: false, instancias: [] };
  try {
    const r = await fetch(`${WA_URL}/status`, { cache: "no-store" });
    if (r.ok) whatsapp = { online: true, ...(await r.json()) };
  } catch {
    /* offline */
  }

  return NextResponse.json({
    ok: true,
    token_origem: auth.origem,
    ofertas_total: totalOfertas,
    ofertas_pendentes: pendentes,
    piloto: automacao,
    whatsapp,
  });
}

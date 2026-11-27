import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getDbV3 } from "@/lib/db-v3";
import { getDbV4 } from "@/lib/db-v4";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { escopo?: string };
  const escopo = body.escopo || "exemplos";
  const db = getDb();
  getDbV3();
  getDbV4();

  if (escopo === "cascata_demo" || escopo === "tudo_demo") {
    db.prepare("DELETE FROM grupos_cascata WHERE id LIKE 'grp_demo%' OR link_convite LIKE '%exemplo-%'").run();
  }
  if (escopo === "exemplos" || escopo === "tudo_demo") {
    db.prepare("DELETE FROM ofertas WHERE exemplo = 1").run();
  }
  if (escopo === "tudo_demo") {
    db.prepare("DELETE FROM crm_contatos WHERE id LIKE 'crm_demo%'").run();
    db.prepare("DELETE FROM cupons WHERE id LIKE 'cup_demo%'").run();
  }
  if (escopo === "ofertas_fila") {
    db.prepare("DELETE FROM ofertas").run();
    db.prepare("DELETE FROM automacao_log").run();
  }

  return NextResponse.json({ ok: true, escopo });
}
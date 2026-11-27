import { NextResponse } from "next/server";
import { getDb, getConfigOperacao } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const envios = db
    .prepare(`
      SELECT e.*, o.titulo as oferta_titulo, o.loja as oferta_loja, o.preco as oferta_preco
      FROM envios e
      LEFT JOIN ofertas o ON o.id = e.oferta_id
      ORDER BY e.criado_em DESC
      LIMIT 100
    `)
    .all();

  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const hoje = db
    .prepare(
      "SELECT COUNT(*) as total FROM envios WHERE status IN ('enviado', 'simulado') AND criado_em >= ?"
    )
    .get(inicioHoje.toISOString()) as { total: number };

  return NextResponse.json({
    envios,
    envios_hoje: hoje.total,
    config: getConfigOperacao(),
  });
}

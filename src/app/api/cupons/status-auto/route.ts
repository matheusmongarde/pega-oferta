import { NextResponse } from "next/server";
import { getDbV3, type Cupom } from "@/lib/db-v3";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    texto?: string;
    status?: "acabando" | "expirado";
    loja?: string;
    codigo?: string;
  };

  const status = body.status === "expirado" ? "expirado" : "acabando";
  const texto = (body.texto || "").trim();
  const db = getDbV3();

  // 1. Se veio codigo explicito ou encontrado no texto, atualiza esse cupom exato
  const codigoExplicito = (body.codigo || "").trim().toUpperCase();
  const matchCod =
    codigoExplicito ||
    texto.match(/(?:cupom|c[oó]digo)[:\s*`"'#-]+([A-Z0-9_-]{3,22})\b/i)?.[1]?.toUpperCase() ||
    texto.match(/\b([A-Z]{2,}[0-9]{1,}[A-Z0-9]*)\b/)?.[1]?.toUpperCase() ||
    "";

  if (matchCod) {
    const row = db
      .prepare("SELECT * FROM cupons WHERE codigo = ? LIMIT 1")
      .get(matchCod) as unknown as Cupom | undefined;
    if (row) {
      db.prepare("UPDATE cupons SET status = ? WHERE id = ?").run(status, row.id);
      return NextResponse.json({ ok: true, atualizado: row.codigo, status });
    }
  }

  // 2. Se nao citou o codigo, tenta atualizar o cupom ativo mais recente da loja citada (ultimas 6h)
  const loja = (body.loja || "").trim().toLowerCase();
  const seisHorasAtras = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const recente = loja
    ? (db
        .prepare(
          "SELECT * FROM cupons WHERE loja = ? AND status != 'expirado' AND criado_em >= ? ORDER BY criado_em DESC LIMIT 1"
        )
        .get(loja, seisHorasAtras) as unknown as Cupom | undefined)
    : (db
        .prepare(
          "SELECT * FROM cupons WHERE status != 'expirado' AND criado_em >= ? ORDER BY criado_em DESC LIMIT 1"
        )
        .get(seisHorasAtras) as unknown as Cupom | undefined);

  if (recente) {
    db.prepare("UPDATE cupons SET status = ? WHERE id = ?").run(status, recente.id);
    return NextResponse.json({ ok: true, atualizado: recente.codigo, status });
  }

  return NextResponse.json({ ok: false, motivo: "Nenhum cupom recente correspondente." });
}

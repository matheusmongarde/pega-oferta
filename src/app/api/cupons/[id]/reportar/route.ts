import { NextResponse } from "next/server";
import { getDbV3, type Cupom } from "@/lib/db-v3";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDbV3();
  const cupom = db.prepare("SELECT * FROM cupons WHERE id = ?").get(id) as Cupom | undefined;
  if (!cupom) return NextResponse.json({ erro: "Cupom nao encontrado." }, { status: 404 });

  const novosReportes = (cupom.reportes_expirado || 0) + 1;
  const novoStatus = novosReportes >= 3 ? "expirado" : novosReportes >= 2 ? "acabando" : cupom.status;

  db.prepare("UPDATE cupons SET reportes_expirado = ?, status = ? WHERE id = ?").run(
    novosReportes,
    novoStatus,
    id
  );

  const atualizado = db.prepare("SELECT * FROM cupons WHERE id = ?").get(id);
  return NextResponse.json({ cupom: atualizado });
}
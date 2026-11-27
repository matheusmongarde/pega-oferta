import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDb();
  const body = (await req.json()) as { ativa?: boolean; url?: string; nome?: string };

  if (typeof body.ativa === "boolean") {
    db.prepare("UPDATE fontes SET ativa = ? WHERE id = ?").run(body.ativa ? 1 : 0, id);
  }
  if (typeof body.url === "string") {
    db.prepare("UPDATE fontes SET url = ? WHERE id = ?").run(body.url.trim(), id);
  }
  if (typeof body.nome === "string") {
    db.prepare("UPDATE fontes SET nome = ? WHERE id = ?").run(body.nome.trim(), id);
  }

  const fonte = db.prepare("SELECT * FROM fontes WHERE id = ?").get(id);
  return NextResponse.json({ fonte });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDb();
  db.prepare("DELETE FROM fontes WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
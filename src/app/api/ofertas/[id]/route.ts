import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDb();
  const body = (await req.json()) as {
    status?: string;
    titulo?: string;
    preco?: number;
    cupom?: string;
  };

  const existente = db.prepare("SELECT id FROM ofertas WHERE id = ?").get(id);
  if (!existente) {
    return NextResponse.json({ erro: "Oferta nao encontrada." }, { status: 404 });
  }

  if (body.status) {
    db.prepare("UPDATE ofertas SET status = ? WHERE id = ?").run(body.status, id);
  }
  if (typeof body.titulo === "string") {
    db.prepare("UPDATE ofertas SET titulo = ? WHERE id = ?").run(body.titulo, id);
  }
  if (typeof body.preco === "number") {
    db.prepare("UPDATE ofertas SET preco = ? WHERE id = ?").run(body.preco, id);
  }
  if (typeof body.cupom === "string") {
    db.prepare("UPDATE ofertas SET cupom = ? WHERE id = ?").run(body.cupom, id);
  }

  const oferta = db.prepare("SELECT * FROM ofertas WHERE id = ?").get(id);
  return NextResponse.json({ oferta });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDb();
  db.prepare("DELETE FROM ofertas WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
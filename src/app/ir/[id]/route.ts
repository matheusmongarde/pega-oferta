import { NextResponse } from "next/server";
import { getDb, type Oferta } from "@/lib/db";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDb();
  const oferta = db.prepare("SELECT * FROM ofertas WHERE id = ?").get(id) as
    | Oferta
    | undefined;

  if (!oferta || !oferta.url_afiliado) {
    return NextResponse.redirect(new URL("/vitrine", req.url));
  }

  db.prepare("UPDATE ofertas SET cliques = cliques + 1 WHERE id = ?").run(id);
  return NextResponse.redirect(oferta.url_afiliado, { status: 302 });
}
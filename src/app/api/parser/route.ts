import { NextResponse } from "next/server";
import { getDb, type Marca } from "@/lib/db";
import { parsearTextoOferta } from "@/lib/parser";
import { jaExisteRecente } from "@/lib/coletor";

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json()) as { texto?: string; marca_id?: string };
  if (!body.texto || !body.texto.trim()) {
    return NextResponse.json({ erro: "Informe um texto ou link." }, { status: 400 });
  }

  const marca = (
    body.marca_id
      ? db.prepare("SELECT * FROM marcas WHERE id = ?").get(body.marca_id)
      : db.prepare("SELECT * FROM marcas ORDER BY criado_em ASC LIMIT 1").get()
  ) as Marca | undefined;

  if (!marca) {
    return NextResponse.json({ erro: "Marca nao encontrada." }, { status: 404 });
  }

  const parseada = await parsearTextoOferta(body.texto, marca);
  const duplicada = jaExisteRecente(parseada.hash_dedup);
  return NextResponse.json({ parseada, duplicada });
}

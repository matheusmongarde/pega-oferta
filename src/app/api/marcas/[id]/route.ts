import { normalizarTagMercadoLivre } from "@/lib/afiliado";
import { NextResponse } from "next/server";
import { getDb, type Marca } from "@/lib/db";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDb();
  const body = (await req.json()) as Partial<Marca>;

  const atual = db.prepare("SELECT * FROM marcas WHERE id = ?").get(id) as Marca | undefined;
  if (!atual) {
    return NextResponse.json({ erro: "Marca nao encontrada." }, { status: 404 });
  }

  db.prepare(`
    UPDATE marcas SET
      nome = ?,
      nichos = ?,
      palavras_bloqueadas = ?,
      preco_min = ?,
      preco_max = ?,
      amazon_tag = ?,
      shopee_id = ?,
      mercadolivre_tag = ?,
      aliexpress_id = ?,
      awin_id = ?,
      template_mensagem = ?
    WHERE id = ?
  `).run(
    body.nome ?? atual.nome,
    body.nichos ?? atual.nichos,
    body.palavras_bloqueadas ?? atual.palavras_bloqueadas,
    body.preco_min !== undefined ? Number(body.preco_min) : atual.preco_min,
    body.preco_max !== undefined ? Number(body.preco_max) : atual.preco_max,
    body.amazon_tag ?? atual.amazon_tag,
    body.shopee_id ?? atual.shopee_id,
    body.mercadolivre_tag !== undefined ? normalizarTagMercadoLivre(body.mercadolivre_tag) : atual.mercadolivre_tag,
    body.aliexpress_id ?? atual.aliexpress_id,
    body.awin_id ?? atual.awin_id,
    body.template_mensagem ?? atual.template_mensagem,
    id
  );

  const marca = db.prepare("SELECT * FROM marcas WHERE id = ?").get(id);
  return NextResponse.json({ marca });
}
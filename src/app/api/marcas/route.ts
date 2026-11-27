import { normalizarTagMercadoLivre } from "@/lib/afiliado";
import { NextResponse } from "next/server";
import { getDb, gerarId, type Marca } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const marcas = db
    .prepare("SELECT * FROM marcas ORDER BY criado_em ASC")
    .all() as unknown as Marca[];
  return NextResponse.json({ marcas });
}

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json()) as Partial<Marca>;
  if (!body.nome?.trim()) {
    return NextResponse.json({ erro: "Nome da marca obrigatorio." }, { status: 400 });
  }

  const id = gerarId("mrc");
  const slugBase = body.nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${slugBase || "marca"}-${id.slice(-4)}`;

  const templatePadrao =
    body.template_mensagem ||
    "*{{titulo}}*\n\n{{bloco_preco}}\n{{bloco_cupom}}\nLoja: {{loja}}\nPegar oferta: {{link}}";

  db.prepare(`
    INSERT INTO marcas (
      id, nome, slug, nichos, palavras_bloqueadas, preco_min, preco_max,
      amazon_tag, shopee_id, mercadolivre_tag, aliexpress_id, awin_id,
      template_mensagem, ativa, criado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    id,
    body.nome.trim(),
    slug,
    body.nichos || "",
    body.palavras_bloqueadas || "",
    Number(body.preco_min) || 0,
    Number(body.preco_max) || 0,
    body.amazon_tag || "",
    body.shopee_id || "",
    normalizarTagMercadoLivre(body.mercadolivre_tag),
    body.aliexpress_id || "",
    body.awin_id || "",
    templatePadrao,
    new Date().toISOString()
  );

  const marca = db.prepare("SELECT * FROM marcas WHERE id = ?").get(id);
  return NextResponse.json({ marca }, { status: 201 });
}

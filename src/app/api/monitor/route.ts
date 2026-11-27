import { NextResponse } from "next/server";
import { z } from "zod";
import { gerarId } from "@/lib/db";
import { getDbV4, type MonitorPreco } from "@/lib/db-v4";
import { detectarLoja } from "@/lib/afiliado";
import { extrairMetadadosUrl } from "@/lib/scraper-og";

export const dynamic = "force-dynamic";

const criarSchema = z.object({
  url: z.string().url(),
  titulo: z.string().optional().default(""),
  preco_alvo: z.coerce.number().min(1),
  preco_atual: z.coerce.number().optional().default(0),
});

export async function GET() {
  const db = getDbV4();
  const rows = db
    .prepare("SELECT * FROM monitores_preco ORDER BY CASE status WHEN 'alvo_atingido' THEN 0 ELSE 1 END, criado_em DESC")
    .all() as unknown as MonitorPreco[];
  return NextResponse.json({
    monitores: rows.map((r) => ({ ...r })),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = criarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ erro: "Informe uma URL valida e um preco-alvo." }, { status: 400 });
  }

  const db = getDbV4();
  const { url, preco_alvo } = parsed.data;
  const loja = detectarLoja(url);
  const meta = await extrairMetadadosUrl(url);

  const titulo = parsed.data.titulo.trim() || meta.tituloPagina || "Produto monitorado";
  const precoAtual = meta.precoAtual > 0 ? meta.precoAtual : parsed.data.preco_atual || 0;
  const menorPreco = precoAtual > 0 ? precoAtual : 0;
  const status = precoAtual > 0 && precoAtual <= preco_alvo ? "alvo_atingido" : "monitorando";
  const agora = new Date().toISOString();
  const id = gerarId("mon");

  db.prepare(`
    INSERT INTO monitores_preco
      (id, titulo, url, loja, imagem_url, preco_atual, preco_alvo, menor_preco, ativo, status, ultimo_check, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(id, titulo, url, loja, meta.imagemUrl, precoAtual, preco_alvo, menorPreco, status, agora, agora);

  const criado = db.prepare("SELECT * FROM monitores_preco WHERE id = ?").get(id) as unknown as MonitorPreco;
  return NextResponse.json({ monitor: { ...criado } }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "ID obrigatorio" }, { status: 400 });
  const db = getDbV4();
  db.prepare("DELETE FROM monitores_preco WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
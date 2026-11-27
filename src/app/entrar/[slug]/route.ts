import { NextResponse } from "next/server";
import { gerarId } from "@/lib/db";
import { getDbV3, type GrupoCascata } from "@/lib/db-v3";

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const { searchParams } = new URL(req.url);
  const utmSource = (searchParams.get("utm_source") || "direto").slice(0, 40);

  const db = getDbV3();
  const grupos = db
    .prepare(
      "SELECT * FROM grupos_cascata WHERE campanha_slug = ? AND ativo = 1 ORDER BY ordem ASC"
    )
    .all(slug) as unknown as GrupoCascata[];

  if (grupos.length === 0) {
    return NextResponse.redirect(new URL("/vitrine", req.url));
  }

  // Primeiro grupo abaixo do limite; se todos estiverem lotados, cai no ultimo
  const escolhido =
    grupos.find((g) => g.membros_atuais < g.limite_membros) ||
    grupos[grupos.length - 1]!;

  db.prepare("UPDATE grupos_cascata SET cliques = cliques + 1 WHERE id = ?").run(
    escolhido.id
  );
  db.prepare(
    "INSERT INTO cliques_cascata (id, campanha_slug, grupo_id, utm_source, criado_em) VALUES (?, ?, ?, ?, ?)"
  ).run(gerarId("clq"), slug, escolhido.id, utmSource, new Date().toISOString());

  return NextResponse.redirect(escolhido.link_convite, { status: 302 });
}
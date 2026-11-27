import { NextResponse } from "next/server";
import { gerarId } from "@/lib/db";
import { getDbV3, type GrupoCascata } from "@/lib/db-v3";

export async function GET() {
  const db = getDbV3();
  const grupos = db
    .prepare("SELECT * FROM grupos_cascata ORDER BY campanha_slug ASC, ordem ASC")
    .all() as unknown as GrupoCascata[];

  const utms = db
    .prepare(
      "SELECT campanha_slug, utm_source, COUNT(*) as total FROM cliques_cascata GROUP BY campanha_slug, utm_source ORDER BY total DESC"
    )
    .all() as unknown as Array<{ campanha_slug: string; utm_source: string; total: number }>;

  return NextResponse.json({ grupos, utms });
}

export async function POST(req: Request) {
  const db = getDbV3();
  const body = (await req.json()) as Partial<GrupoCascata>;
  if (!body.campanha_slug?.trim() || !body.nome_grupo?.trim() || !body.link_convite?.trim()) {
    return NextResponse.json(
      { erro: "Slug da campanha, nome do grupo e link de convite sao obrigatorios." },
      { status: 400 }
    );
  }

  const slug = body.campanha_slug
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");

  const maxOrdem = (
    db
      .prepare("SELECT COALESCE(MAX(ordem), 0) as m FROM grupos_cascata WHERE campanha_slug = ?")
      .get(slug) as { m: number }
  ).m;

  const id = gerarId("grp");
  db.prepare(`
    INSERT INTO grupos_cascata (id, campanha_slug, campanha_nome, ordem, nome_grupo, link_convite, membros_atuais, limite_membros, cliques, ativo, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)
  `).run(
    id,
    slug,
    (body.campanha_nome || slug).trim(),
    body.ordem ? Number(body.ordem) : maxOrdem + 1,
    body.nome_grupo.trim(),
    body.link_convite.trim(),
    Number(body.membros_atuais) || 0,
    Number(body.limite_membros) || 1000,
    new Date().toISOString()
  );

  const grupo = db.prepare("SELECT * FROM grupos_cascata WHERE id = ?").get(id);
  return NextResponse.json({ grupo }, { status: 201 });
}

export async function PATCH(req: Request) {
  const db = getDbV3();
  const body = (await req.json()) as Partial<GrupoCascata> & { id?: string };
  if (!body.id) return NextResponse.json({ erro: "ID obrigatorio." }, { status: 400 });

  if (typeof body.membros_atuais === "number") {
    db.prepare("UPDATE grupos_cascata SET membros_atuais = ? WHERE id = ?").run(
      body.membros_atuais,
      body.id
    );
  }
  if (typeof body.limite_membros === "number") {
    db.prepare("UPDATE grupos_cascata SET limite_membros = ? WHERE id = ?").run(
      body.limite_membros,
      body.id
    );
  }
  if (typeof body.ativo === "number") {
    db.prepare("UPDATE grupos_cascata SET ativo = ? WHERE id = ?").run(body.ativo, body.id);
  }

  const grupo = db.prepare("SELECT * FROM grupos_cascata WHERE id = ?").get(body.id);
  return NextResponse.json({ grupo });
}

export async function DELETE(req: Request) {
  const db = getDbV3();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "ID obrigatorio." }, { status: 400 });
  db.prepare("DELETE FROM grupos_cascata WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
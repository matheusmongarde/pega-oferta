import { NextResponse } from "next/server";
import { getDb, gerarId, type Conexao } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const conexoes = db
    .prepare("SELECT * FROM conexoes ORDER BY criado_em ASC")
    .all() as unknown as Conexao[];
  return NextResponse.json({ conexoes });
}

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json()) as Partial<Conexao>;
  if (!body.nome?.trim() || !body.tipo) {
    return NextResponse.json({ erro: "Nome e tipo obrigatorios." }, { status: 400 });
  }

  const marcaPadrao = db
    .prepare("SELECT id FROM marcas ORDER BY criado_em ASC LIMIT 1")
    .get() as { id: string } | undefined;

  const id = body.id || gerarId("cnx");
  const existe = body.id
    ? db.prepare("SELECT id FROM conexoes WHERE id = ?").get(body.id)
    : null;

  if (existe) {
    db.prepare(`
      UPDATE conexoes SET
        nome = ?, tipo = ?, marca_id = ?, destino = ?, endpoint = ?, token = ?, instancia = ?, ativa = ?
      WHERE id = ?
    `).run(
      body.nome.trim(),
      body.tipo,
      body.marca_id || marcaPadrao?.id || "mrc_principal",
      (body.destino || "").trim(),
      (body.endpoint || "").trim(),
      (body.token || "").trim(),
      (body.instancia || "").trim(),
      body.ativa === 0 ? 0 : 1,
      id
    );
  } else {
    db.prepare(`
      INSERT INTO conexoes (id, tipo, nome, marca_id, destino, endpoint, token, instancia, ativa, ultimo_status, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'configurada', ?)
    `).run(
      id,
      body.tipo,
      body.nome.trim(),
      body.marca_id || marcaPadrao?.id || "mrc_principal",
      (body.destino || "").trim(),
      (body.endpoint || "").trim(),
      (body.token || "").trim(),
      (body.instancia || "").trim(),
      new Date().toISOString()
    );
  }

  const conexao = db.prepare("SELECT * FROM conexoes WHERE id = ?").get(id);
  return NextResponse.json({ conexao }, { status: existe ? 200 : 201 });
}

export async function DELETE(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "ID obrigatorio." }, { status: 400 });
  db.prepare("DELETE FROM conexoes WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}

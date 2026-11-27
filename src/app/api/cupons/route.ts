import { NextResponse } from "next/server";
import { gerarId } from "@/lib/db";
import { getDbV3, type Cupom } from "@/lib/db-v3";

export async function GET() {
  const db = getDbV3();
  const cupons = db
    .prepare("SELECT * FROM cupons ORDER BY CASE status WHEN 'ativo' THEN 1 WHEN 'acabando' THEN 2 ELSE 3 END, criado_em DESC")
    .all() as unknown as Cupom[];
  return NextResponse.json({ cupons });
}

export async function POST(req: Request) {
  const db = getDbV3();
  const body = (await req.json()) as Partial<Cupom>;
  if (!body.codigo?.trim() || !body.loja?.trim()) {
    return NextResponse.json({ erro: "Codigo e loja obrigatorios." }, { status: 400 });
  }

  const id = gerarId("cup");
  db.prepare(`
    INSERT INTO cupons (id, codigo, loja, descricao, valor_minimo, status, reportes_expirado, validade, criado_em)
    VALUES (?, ?, ?, ?, ?, 'ativo', 0, ?, ?)
  `).run(
    id,
    body.codigo.trim().toUpperCase(),
    body.loja.trim(),
    (body.descricao || "").trim(),
    Number(body.valor_minimo) || 0,
    (body.validade || "Ate acabar verba").trim(),
    new Date().toISOString()
  );

  const cupom = db.prepare("SELECT * FROM cupons WHERE id = ?").get(id);
  return NextResponse.json({ cupom }, { status: 201 });
}

export async function PATCH(req: Request) {
  const db = getDbV3();
  const body = (await req.json()) as Partial<Cupom> & { id?: string };
  if (!body.id) return NextResponse.json({ erro: "ID obrigatorio." }, { status: 400 });

  if (body.status) {
    db.prepare("UPDATE cupons SET status = ?, reportes_expirado = CASE WHEN ? = 'ativo' THEN 0 ELSE reportes_expirado END WHERE id = ?").run(
      body.status,
      body.status,
      body.id
    );
  }
  const cupom = db.prepare("SELECT * FROM cupons WHERE id = ?").get(body.id);
  return NextResponse.json({ cupom });
}

export async function DELETE(req: Request) {
  const db = getDbV3();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "ID obrigatorio." }, { status: 400 });
  db.prepare("DELETE FROM cupons WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
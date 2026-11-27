import { NextResponse } from "next/server";
import { gerarId, type Oferta } from "@/lib/db";
import { getDbV3, type CrmContato } from "@/lib/db-v3";

export async function GET() {
  const db = getDbV3();
  const contatos = db
    .prepare("SELECT * FROM crm_contatos ORDER BY criado_em DESC")
    .all() as unknown as CrmContato[];

  const ofertasAtivas = db
    .prepare(
      "SELECT * FROM ofertas WHERE status IN ('nova', 'aprovada', 'enviada') ORDER BY criado_em DESC LIMIT 100"
    )
    .all() as unknown as Oferta[];

  const enriquecidos = contatos.map((c) => {
    const termo = c.desejo_produto.trim().toLowerCase();
    const matches = termo
      ? ofertasAtivas.filter((o) => {
          const bateNome = o.titulo.toLowerCase().includes(termo);
          const batePreco =
            c.desejo_preco_max <= 0 || (o.preco > 0 && o.preco <= c.desejo_preco_max);
          return bateNome && batePreco;
        })
      : [];
    return { ...c, ofertas_match: matches.slice(0, 3) };
  });

  return NextResponse.json({ contatos: enriquecidos });
}

export async function POST(req: Request) {
  const db = getDbV3();
  const body = (await req.json()) as Partial<CrmContato>;
  if (!body.nome?.trim()) {
    return NextResponse.json({ erro: "Nome obrigatorio." }, { status: 400 });
  }

  const id = gerarId("crm");
  db.prepare(`
    INSERT INTO crm_contatos (id, nome, telefone, tags, desejo_produto, desejo_preco_max, status, notas, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.nome.trim(),
    (body.telefone || "").replace(/\D/g, ""),
    (body.tags || "").trim(),
    (body.desejo_produto || "").trim(),
    Number(body.desejo_preco_max) || 0,
    body.status || "ativo",
    (body.notas || "").trim(),
    new Date().toISOString()
  );

  const contato = db.prepare("SELECT * FROM crm_contatos WHERE id = ?").get(id);
  return NextResponse.json({ contato }, { status: 201 });
}

export async function PATCH(req: Request) {
  const db = getDbV3();
  const body = (await req.json()) as Partial<CrmContato> & { id?: string };
  if (!body.id) return NextResponse.json({ erro: "ID obrigatorio." }, { status: 400 });

  if (body.status) {
    db.prepare("UPDATE crm_contatos SET status = ? WHERE id = ?").run(body.status, body.id);
  }
  if (typeof body.notas === "string") {
    db.prepare("UPDATE crm_contatos SET notas = ? WHERE id = ?").run(body.notas, body.id);
  }

  const contato = db.prepare("SELECT * FROM crm_contatos WHERE id = ?").get(body.id);
  return NextResponse.json({ contato });
}

export async function DELETE(req: Request) {
  const db = getDbV3();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "ID obrigatorio." }, { status: 400 });
  db.prepare("DELETE FROM crm_contatos WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
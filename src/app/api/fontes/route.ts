import { NextResponse } from "next/server";
import { getDb, gerarId, normalizarUrlFonte, type Fonte } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const fontes = db
    .prepare("SELECT * FROM fontes ORDER BY criado_em DESC")
    .all() as unknown as Fonte[];
  return NextResponse.json({ fontes });
}

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json()) as {
    nome?: string;
    tipo?: "rss" | "espelho" | "webhook";
    url?: string;
    loja_padrao?: string;
    marca_id?: string;
    intervalo_min?: number;
  };

  if (!body.nome?.trim()) {
    return NextResponse.json({ erro: "Nome da fonte obrigatorio." }, { status: 400 });
  }

  // Mesma URL ja cadastrada? Reativa a existente em vez de criar outra igual.
  const urlNova = (body.url || "").trim();
  if (urlNova) {
    const chave = normalizarUrlFonte(urlNova);
    const existente = (
      db.prepare("SELECT * FROM fontes WHERE url != ''").all() as unknown as Fonte[]
    ).find((f) => normalizarUrlFonte(f.url) === chave);
    if (existente) {
      if (existente.ativa !== 1) db.prepare("UPDATE fontes SET ativa = 1 WHERE id = ?").run(existente.id);
      const fonte = db.prepare("SELECT * FROM fontes WHERE id = ?").get(existente.id);
      return NextResponse.json({ fonte, ja_existia: true });
    }
  }

  const marcaPadrao = db
    .prepare("SELECT id FROM marcas ORDER BY criado_em ASC LIMIT 1")
    .get() as { id: string } | undefined;

  const id = gerarId("fnt");
  db.prepare(`
    INSERT INTO fontes (id, nome, tipo, url, loja_padrao, marca_id, ativa, intervalo_min, ultima_coleta, total_coletadas, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, NULL, 0, ?)
  `).run(
    id,
    body.nome.trim(),
    body.tipo || "rss",
    (body.url || "").trim(),
    body.loja_padrao || "outra",
    body.marca_id || marcaPadrao?.id || "mrc_principal",
    Number(body.intervalo_min) || 15,
    new Date().toISOString()
  );

  const fonte = db.prepare("SELECT * FROM fontes WHERE id = ?").get(id);
  return NextResponse.json({ fonte }, { status: 201 });
}

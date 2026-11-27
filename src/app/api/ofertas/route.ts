import { NextResponse } from "next/server";
import { expirarOfertasAntigas, getDb, gerarId, type Marca, type Oferta } from "@/lib/db";
import { parsearTextoOferta } from "@/lib/parser";
import { jaExisteRecente } from "@/lib/coletor";
import { registrarCupomAutomatico } from "@/lib/scraper-og";
import { registrarPrecoHistorico } from "@/lib/db-v3";

export async function GET(req: Request) {
  expirarOfertasAntigas();
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const loja = searchParams.get("loja");
  const busca = searchParams.get("q");

  let sql = "SELECT * FROM ofertas WHERE 1=1";
  const params: (string | number)[] = [];

  if (status === "expiradas") {
    sql += " AND status = 'descartada'";
  } else if (status && status !== "todas") {
    sql += " AND status = ?";
    params.push(status);
  } else {
    sql += " AND status != 'descartada'";
  }
  sql += " AND exemplo = 0";
  if (loja && loja !== "todas") {
    sql += " AND loja = ?";
    params.push(loja);
  }
  if (busca && busca.trim()) {
    sql += " AND (LOWER(titulo) LIKE ? OR LOWER(cupom) LIKE ?)";
    const term = `%${busca.trim().toLowerCase()}%`;
    params.push(term, term);
  }

  sql += " ORDER BY criado_em DESC LIMIT 1000";
  const ofertas = db.prepare(sql).all(...params) as unknown as Oferta[];

  // Contagem real por status (mesma regra do menu lateral), sem exemplos
  const linhas = db
    .prepare("SELECT status, COUNT(*) as total FROM ofertas WHERE exemplo = 0 GROUP BY status")
    .all() as Array<{ status: string; total: number }>;
  const por = Object.fromEntries(linhas.map((l) => [l.status, Number(l.total)])) as Record<string, number>;
  const contagem = {
    nova: por.nova || 0,
    aprovada: por.aprovada || 0,
    enviada: por.enviada || 0,
    expiradas: por.descartada || 0,
    todas: (por.nova || 0) + (por.aprovada || 0) + (por.enviada || 0),
  };
  return NextResponse.json({ ofertas, contagem });
}

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json()) as {
    texto?: string;
    marca_id?: string;
    aprovar?: boolean;
    forcar_duplicada?: boolean;
  };

  if (!body.texto || !body.texto.trim()) {
    return NextResponse.json({ erro: "Cole um texto ou link de oferta." }, { status: 400 });
  }

  const marca = (
    body.marca_id
      ? db.prepare("SELECT * FROM marcas WHERE id = ?").get(body.marca_id)
      : db.prepare("SELECT * FROM marcas ORDER BY criado_em ASC LIMIT 1").get()
  ) as Marca | undefined;

  if (!marca) {
    return NextResponse.json({ erro: "Nenhuma marca encontrada." }, { status: 400 });
  }

  const parseada = await parsearTextoOferta(body.texto, marca);

  if (!body.forcar_duplicada && jaExisteRecente(parseada.hash_dedup)) {
    return NextResponse.json(
      {
        erro: "Oferta repetida bloqueada pela deduplicacao.",
        duplicada: true,
        parseada,
      },
      { status: 409 }
    );
  }

  const id = gerarId("ofr");
  const agora = new Date().toISOString();
  const statusInicial = body.aprovar ? "aprovada" : "nova";

  db.prepare(`
    INSERT INTO ofertas (
      id, marca_id, fonte_id, titulo, loja, preco, preco_antigo, desconto_pct,
      cupom, url_original, url_afiliado, imagem_url, hash_dedup, status,
      cliques, exemplo, texto_original, criado_em, enviada_em
    ) VALUES (?, ?, 'fnt_manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, NULL)
  `).run(
    id,
    marca.id,
    parseada.titulo,
    parseada.loja,
    parseada.preco,
    parseada.preco_antigo,
    parseada.desconto_pct,
    parseada.cupom,
    parseada.url_original,
    parseada.url_afiliado,
    parseada.imagem_url,
    parseada.hash_dedup,
    statusInicial,
    body.texto.trim(),
    agora
  );

  if (parseada.cupom) registrarCupomAutomatico(parseada.cupom, parseada.loja, parseada.titulo);
  registrarPrecoHistorico(parseada.hash_dedup, parseada.preco);
  const oferta = db.prepare("SELECT * FROM ofertas WHERE id = ?").get(id);
  return NextResponse.json({ oferta, parseada }, { status: 201 });
}

export async function DELETE(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  if (searchParams.get("exemplos") === "1") {
    db.prepare("DELETE FROM ofertas WHERE exemplo = 1").run();
    return NextResponse.json({ ok: true, mensagem: "Ofertas de exemplo removidas." });
  }
  return NextResponse.json({ erro: "Parametro exemplos=1 obrigatorio." }, { status: 400 });
}

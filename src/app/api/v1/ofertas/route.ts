import { NextResponse } from "next/server";
import { gerarId, type Marca } from "@/lib/db";
import { getDbV4 } from "@/lib/db-v4";
import { parsearTextoOferta } from "@/lib/parser";
import { jaExisteRecente } from "@/lib/coletor";
import { dispararOferta } from "@/lib/disparador";
import { registrarCupomAutomatico } from "@/lib/scraper-og";
import { registrarPrecoHistorico } from "@/lib/db-v3";
import { autenticarApiV1 } from "@/lib/api-tokens";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!autenticarApiV1(req).ok) {
    return NextResponse.json({ erro: "Token de API invalido ou ausente. Envie Authorization: Bearer po_live_..." }, { status: 401 });
  }
  const db = getDbV4();
  const ofertas = db.prepare("SELECT * FROM ofertas ORDER BY criado_em DESC LIMIT 50").all();
  return NextResponse.json({ ofertas });
}

export async function POST(req: Request) {
  if (!autenticarApiV1(req).ok) {
    return NextResponse.json({ erro: "Token de API invalido ou ausente. Envie Authorization: Bearer po_live_..." }, { status: 401 });
  }
  const db = getDbV4();
  const body = (await req.json()) as {
    texto?: string;
    marca_id?: string;
    disparar?: boolean;
    origem_label?: string;
    imagem_url?: string;
    criado_em?: string;
  };

  if (!body.texto?.trim()) {
    return NextResponse.json({ erro: "Campo texto obrigatorio." }, { status: 400 });
  }

  const marca = (
    body.marca_id
      ? db.prepare("SELECT * FROM marcas WHERE id = ?").get(body.marca_id)
      : db.prepare("SELECT * FROM marcas ORDER BY criado_em ASC LIMIT 1").get()
  ) as Marca | undefined;

  if (!marca) {
    return NextResponse.json({ erro: "Marca nao encontrada." }, { status: 404 });
  }

  const parseada = await parsearTextoOferta(body.texto, marca);
  if (jaExisteRecente(parseada.hash_dedup)) {
    return NextResponse.json({ duplicada: true, parseada }, { status: 409 });
  }

  const id = gerarId("ofr");
  const origemLabel = (body.origem_label || "").trim() || "API / Extensao";
  const imagem = (body.imagem_url || "").trim() || parseada.imagem_url;
  const statusInicial = body.disparar ? "aprovada" : "nova";

  const criadoEm =
    body.criado_em && !Number.isNaN(Date.parse(body.criado_em))
      ? new Date(body.criado_em).toISOString()
      : new Date().toISOString();

  db.prepare(`
    INSERT INTO ofertas (
      id, marca_id, fonte_id, titulo, loja, preco, preco_antigo, desconto_pct,
      cupom, url_original, url_afiliado, imagem_url, hash_dedup, status,
      cliques, exemplo, texto_original, origem_label, criado_em, enviada_em
    ) VALUES (?, ?, 'api_v1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, NULL)
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
    imagem,
    parseada.hash_dedup,
    statusInicial,
    body.texto.trim(),
    origemLabel,
    criadoEm
  );

  if (parseada.cupom) registrarCupomAutomatico(parseada.cupom, parseada.loja, parseada.titulo);
  registrarPrecoHistorico(parseada.hash_dedup, parseada.preco);
  const disparo = body.disparar ? await dispararOferta(id) : null;
  const oferta = db.prepare("SELECT * FROM ofertas WHERE id = ?").get(id);
  return NextResponse.json({ oferta, disparo }, { status: 201 });
}

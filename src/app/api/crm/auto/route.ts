import { NextResponse } from "next/server";
import { gerarId, type Oferta } from "@/lib/db";
import { getDbV3 } from "@/lib/db-v3";

export const dynamic = "force-dynamic";

function extrairDesejo(texto: string): { produto: string; precoMax: number } | null {
  const limpo = texto.trim();
  const m = limpo.match(
    /(?:quero|procurando|me\s*avisa|avisa\s*quando|alerta\s*de|buscando)\s+(?:um|uma|de)?\s*([^.,!?\n]{3,60}?)(?:\s+(?:at[eé]|abaixo\s+de|menos\s+de|por\s+at[eé]|<=?)\s*(?:R\$\s*)?([\d.,]+))?$/i
  );
  if (!m) return null;
  const produto = (m[1] || "").replace(/\s+(?:baixar|cair|ficar|chegar).*$/i, "").trim();
  if (produto.length < 3) return null;

  let precoMax = 0;
  if (m[2]) {
    const raw = m[2].replace(/\./g, "").replace(",", ".");
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) precoMax = n;
  }
  return { produto, precoMax };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    telefone?: string;
    nome?: string;
    texto?: string;
  };

  const telefone = (body.telefone || "").replace(/\D/g, "");
  const texto = (body.texto || "").trim();
  if (!telefone || !texto) {
    return NextResponse.json({ ignorado: true, motivo: "Sem telefone ou texto" }, { status: 400 });
  }

  const desejo = extrairDesejo(texto);
  if (!desejo) {
    return NextResponse.json({ ignorado: true, motivo: "Mensagem nao e pedido de alerta" });
  }

  const db = getDbV3();
  const agora = new Date().toISOString();
  const nome = (body.nome || "").trim() || `Lead ${telefone.slice(-4)}`;

  const existente = db
    .prepare("SELECT id FROM crm_contatos WHERE telefone = ? LIMIT 1")
    .get(telefone) as { id: string } | undefined;

  let contatoId: string;
  if (existente) {
    contatoId = existente.id;
    db.prepare(`
      UPDATE crm_contatos
      SET desejo_produto = ?, desejo_preco_max = ?, status = 'ativo', notas = ?
      WHERE id = ?
    `).run(desejo.produto, desejo.precoMax, `Capturado via WhatsApp: "${texto.slice(0, 120)}"`, contatoId);
  } else {
    contatoId = gerarId("crm");
    db.prepare(`
      INSERT INTO crm_contatos (id, nome, telefone, tags, desejo_produto, desejo_preco_max, status, notas, criado_em)
      VALUES (?, ?, ?, 'whatsapp, auto', ?, ?, 'ativo', ?, ?)
    `).run(
      contatoId,
      nome,
      telefone,
      desejo.produto,
      desejo.precoMax,
      `Capturado via WhatsApp: "${texto.slice(0, 120)}"`,
      agora
    );
  }

  // Checa se ja existe oferta no catalogo que bate com esse desejo
  const ofertas = db
    .prepare("SELECT * FROM ofertas WHERE status != 'descartada' ORDER BY criado_em DESC LIMIT 50")
    .all() as unknown as Oferta[];
  const termo = desejo.produto.toLowerCase();
  const match = ofertas.find((o) => {
    const bateNome = o.titulo.toLowerCase().includes(termo);
    const batePreco = desejo.precoMax <= 0 || (o.preco > 0 && o.preco <= desejo.precoMax);
    return bateNome && batePreco;
  });

  return NextResponse.json({
    ok: true,
    contato_id: contatoId,
    desejo,
    match_imediato: match
      ? { id: match.id, titulo: match.titulo, preco_atual: match.preco, url_afiliado: match.url_afiliado }
      : null,
  }, { status: 201 });
}
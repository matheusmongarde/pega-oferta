import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface Marca {
  id: string;
  nome: string;
  slug: string;
  nichos: string; // comma-separated
  palavras_bloqueadas: string;
  preco_min: number;
  preco_max: number;
  amazon_tag: string;
  shopee_id: string;
  mercadolivre_tag: string;
  aliexpress_id: string;
  awin_id: string;
  template_mensagem: string;
  ativa: number;
  criado_em: string;
}

export interface Fonte {
  id: string;
  nome: string;
  tipo: "rss" | "manual" | "espelho" | "webhook";
  url: string;
  loja_padrao: string;
  marca_id: string;
  ativa: number;
  intervalo_min: number;
  ultima_coleta: string | null;
  total_coletadas: number;
  criado_em: string;
}

export interface Oferta {
  id: string;
  marca_id: string;
  fonte_id: string | null;
  titulo: string;
  loja: string;
  preco: number;
  preco_antigo: number | null;
  desconto_pct: number | null;
  cupom: string;
  url_original: string;
  url_afiliado: string;
  imagem_url: string;
  hash_dedup: string;
  status: "nova" | "aprovada" | "enviada" | "descartada";
  cliques: number;
  exemplo: number;
  origem_label?: string;
  texto_original: string;
  criado_em: string;
  enviada_em: string | null;
}

export interface Conexao {
  id: string;
  tipo: "telegram" | "whatsapp_evolution" | "whatsapp_zapi" | "whatsapp_baileys" | "webhook";
  nome: string;
  marca_id: string;
  destino: string; // chat_id, group_jid, ou URL
  endpoint: string; // URL base da Evolution/Z-API ou vazio no Telegram
  token: string;
  instancia: string;
  ativa: number;
  ultimo_status: string;
  criado_em: string;
}

export interface Envio {
  id: string;
  oferta_id: string;
  conexao_id: string | null;
  canal: string;
  destino: string;
  status: "enviado" | "simulado" | "erro" | "bloqueado";
  detalhe: string;
  mensagem: string;
  criado_em: string;
}

export interface ConfigOperacao {
  modo_teste: boolean;
  limite_diario: number;
  intervalo_segundos: number;
  janela_dedup_horas: number;
  expirar_ofertas_horas: number;
  horario_inicio: string;
  horario_fim: string;
  nome_vitrine: string;
  subtitulo_vitrine: string;
  arroba_marca: string;
  logo_data_url: string;
  awin_api_token: string;
}

const DEFAULT_CONFIG: ConfigOperacao = {
  modo_teste: false,
  limite_diario: 80,
  intervalo_segundos: 45,
  janela_dedup_horas: 24,
  expirar_ofertas_horas: 24,
  horario_inicio: "08:00",
  horario_fim: "23:00",
  nome_vitrine: "Pega Oferta",
  subtitulo_vitrine: "Achados verificados do dia com cupom e link direto.",
  arroba_marca: "@pegaoferta",
  logo_data_url: "",
  awin_api_token: "",
};

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dadosDir = path.join(process.cwd(), "dados");
  if (!fs.existsSync(dadosDir)) {
    fs.mkdirSync(dadosDir, { recursive: true });
  }

  const dbPath = path.join(dadosDir, "pega-oferta.db");
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS marcas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      nichos TEXT NOT NULL DEFAULT '',
      palavras_bloqueadas TEXT NOT NULL DEFAULT '',
      preco_min REAL NOT NULL DEFAULT 0,
      preco_max REAL NOT NULL DEFAULT 0,
      amazon_tag TEXT NOT NULL DEFAULT '',
      shopee_id TEXT NOT NULL DEFAULT '',
      mercadolivre_tag TEXT NOT NULL DEFAULT '',
      aliexpress_id TEXT NOT NULL DEFAULT '',
      awin_id TEXT NOT NULL DEFAULT '',
      template_mensagem TEXT NOT NULL,
      ativa INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fontes (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      loja_padrao TEXT NOT NULL DEFAULT 'outra',
      marca_id TEXT NOT NULL,
      ativa INTEGER NOT NULL DEFAULT 1,
      intervalo_min INTEGER NOT NULL DEFAULT 15,
      ultima_coleta TEXT,
      total_coletadas INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ofertas (
      id TEXT PRIMARY KEY,
      marca_id TEXT NOT NULL,
      fonte_id TEXT,
      titulo TEXT NOT NULL,
      loja TEXT NOT NULL,
      preco REAL NOT NULL DEFAULT 0,
      preco_antigo REAL,
      desconto_pct INTEGER,
      cupom TEXT NOT NULL DEFAULT '',
      url_original TEXT NOT NULL,
      url_afiliado TEXT NOT NULL,
      imagem_url TEXT NOT NULL DEFAULT '',
      hash_dedup TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'nova',
      cliques INTEGER NOT NULL DEFAULT 0,
      exemplo INTEGER NOT NULL DEFAULT 0,
      texto_original TEXT NOT NULL DEFAULT '',
      criado_em TEXT NOT NULL,
      enviada_em TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_ofertas_hash ON ofertas(hash_dedup);
    CREATE INDEX IF NOT EXISTS idx_ofertas_status ON ofertas(status);

    CREATE TABLE IF NOT EXISTS conexoes (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      nome TEXT NOT NULL,
      marca_id TEXT NOT NULL,
      destino TEXT NOT NULL DEFAULT '',
      endpoint TEXT NOT NULL DEFAULT '',
      token TEXT NOT NULL DEFAULT '',
      instancia TEXT NOT NULL DEFAULT '',
      ativa INTEGER NOT NULL DEFAULT 1,
      ultimo_status TEXT NOT NULL DEFAULT 'nao_testada',
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS envios (
      id TEXT PRIMARY KEY,
      oferta_id TEXT NOT NULL,
      conexao_id TEXT,
      canal TEXT NOT NULL,
      destino TEXT NOT NULL,
      status TEXT NOT NULL,
      detalhe TEXT NOT NULL DEFAULT '',
      mensagem TEXT NOT NULL DEFAULT '',
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `);

  seedInitialData(db);
  limparDemosEDuplicadas(db);
  dbInstance = db;
  return db;
}

export function gerarId(prefixo: string): string {
  return `${prefixo}_${crypto.randomBytes(5).toString("hex")}`;
}

export function getConfigOperacao(): ConfigOperacao {
  const db = getDb();
  const rows = db.prepare("SELECT chave, valor FROM configuracoes").all() as Array<{
    chave: string;
    valor: string;
  }>;
  const map = new Map(rows.map((r) => [r.chave, r.valor]));
  return {
    modo_teste: map.has("modo_teste") ? map.get("modo_teste") === "true" : DEFAULT_CONFIG.modo_teste,
    limite_diario: Number(map.get("limite_diario") ?? DEFAULT_CONFIG.limite_diario),
    intervalo_segundos: Number(map.get("intervalo_segundos") ?? DEFAULT_CONFIG.intervalo_segundos),
    janela_dedup_horas: Number(map.get("janela_dedup_horas") ?? DEFAULT_CONFIG.janela_dedup_horas),
    expirar_ofertas_horas: Number(
      map.get("expirar_ofertas_horas") ?? DEFAULT_CONFIG.expirar_ofertas_horas
    ),
    horario_inicio: map.get("horario_inicio") ?? DEFAULT_CONFIG.horario_inicio,
    horario_fim: map.get("horario_fim") ?? DEFAULT_CONFIG.horario_fim,
    nome_vitrine: map.get("nome_vitrine") ?? DEFAULT_CONFIG.nome_vitrine,
    subtitulo_vitrine: map.get("subtitulo_vitrine") ?? DEFAULT_CONFIG.subtitulo_vitrine,
    arroba_marca: map.get("arroba_marca") ?? DEFAULT_CONFIG.arroba_marca,
    logo_data_url: map.get("logo_data_url") ?? DEFAULT_CONFIG.logo_data_url,
    awin_api_token: map.get("awin_api_token") ?? DEFAULT_CONFIG.awin_api_token,
  };
}

export function salvarConfigOperacao(parcial: Partial<ConfigOperacao>): ConfigOperacao {
  const db = getDb();
  const atual = getConfigOperacao();
  const proximo: ConfigOperacao = { ...atual, ...parcial };
  const stmt = db.prepare(
    "INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor"
  );
  for (const [k, v] of Object.entries(proximo)) {
    stmt.run(k, String(v));
  }
  return proximo;
}

export function expirarOfertasAntigas(): number {
  const cfg = getConfigOperacao();
  const horas = Number(cfg.expirar_ofertas_horas) || 0;
  if (horas <= 0) return 0;
  const db = getDb();
  const limiteIso = new Date(Date.now() - horas * 3600 * 1000).toISOString();
  const r = db
    .prepare(
      "UPDATE ofertas SET status = 'descartada' WHERE status IN ('nova', 'aprovada') AND criado_em < ?"
    )
    .run(limiteIso);
  // Remove definitivamente descartadas com mais de 7 dias para manter o banco leve
  const seteDias = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  db.prepare("DELETE FROM ofertas WHERE status = 'descartada' AND criado_em < ?").run(seteDias);
  return Number(r.changes || 0);
}

/**
 * Instalacao limpa: tira os dados de demonstracao antigos (ofertas, envios e
 * conexao ficticia) e junta fontes repetidas (mesma URL) numa so.
 */
function limparDemosEDuplicadas(db: DatabaseSync) {
  try {
    db.prepare("DELETE FROM envios WHERE id LIKE 'env_demo%' OR oferta_id IN (SELECT id FROM ofertas WHERE exemplo = 1)").run();
    db.prepare("DELETE FROM ofertas WHERE exemplo = 1 OR id LIKE 'ofr_demo%'").run();
    db.prepare("DELETE FROM conexoes WHERE id = 'cnx_telegram_demo' AND (token IS NULL OR token = '')").run();
    db.prepare(
      "UPDATE marcas SET amazon_tag = CASE WHEN amazon_tag = 'suatag-20' THEN '' ELSE amazon_tag END, shopee_id = CASE WHEN shopee_id = 'seu_id_shopee' THEN '' ELSE shopee_id END, mercadolivre_tag = CASE WHEN mercadolivre_tag = 'sua_tag_ml' THEN '' ELSE mercadolivre_tag END"
    ).run();

    const fontes = db
      .prepare("SELECT id, url, ativa FROM fontes WHERE url != '' ORDER BY criado_em ASC, id ASC")
      .all() as Array<{ id: string; url: string; ativa: number }>;
    const manter = new Map<string, { id: string; ativa: number }>();
    for (const f of fontes) {
      const chave = normalizarUrlFonte(f.url);
      const ficou = manter.get(chave);
      if (!ficou) {
        manter.set(chave, { id: f.id, ativa: f.ativa });
        continue;
      }
      db.prepare("UPDATE ofertas SET fonte_id = ? WHERE fonte_id = ?").run(ficou.id, f.id);
      if (f.ativa === 1 && ficou.ativa !== 1) {
        db.prepare("UPDATE fontes SET ativa = 1 WHERE id = ?").run(ficou.id);
        ficou.ativa = 1;
      }
      db.prepare("DELETE FROM fontes WHERE id = ?").run(f.id);
    }
  } catch {
    /* banco antigo sem alguma coluna: segue */
  }
}

/** Mesma fonte = mesma URL, ignorando http/https, www, barra final e maiusculas. */
export function normalizarUrlFonte(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function seedInitialData(db: DatabaseSync) {
  // Migra feed antigo do Gatry (hoje SPA sem XML) para Promobit real em bancos existentes
  try {
    db.prepare(
      "UPDATE fontes SET nome = 'Promobit · Ofertas & Cupons ao vivo', url = 'https://www.promobit.com.br/', intervalo_min = 10, ativa = 1 WHERE url LIKE '%gatry.com/feed%'"
    ).run();
    const temPromobitCupons = db
      .prepare("SELECT id FROM fontes WHERE url LIKE '%promobit.com.br/cupons%' LIMIT 1")
      .get() as { id: string } | undefined;
    const marca = db
      .prepare("SELECT id FROM marcas ORDER BY criado_em ASC LIMIT 1")
      .get() as { id: string } | undefined;
    if (!temPromobitCupons && marca?.id) {
      db.prepare(
        "INSERT INTO fontes (id, nome, tipo, url, loja_padrao, marca_id, ativa, intervalo_min, ultima_coleta, total_coletadas, criado_em) VALUES (?, ?, 'rss', ?, 'outra', ?, 1, 15, NULL, 0, ?)"
      ).run(
        "fnt_promobit_cupons",
        "Promobit · Central de Cupons",
        "https://www.promobit.com.br/cupons/",
        marca.id,
        new Date().toISOString()
      );
    }
  } catch {
    /* ignora */
  }

  const count = db.prepare("SELECT COUNT(*) as total FROM marcas").get() as { total: number };
  if (count.total > 0) return;

  const agora = new Date().toISOString();
  const marcaPrincipalId = "mrc_principal";
  const templatePadrao = [
    "*{{titulo}}*",
    "",
    "{{bloco_preco}}",
    "{{bloco_cupom}}",
    "Loja: {{loja}}",
    "Pegar oferta: {{link}}",
  ].join("\n");

  db.prepare(`
    INSERT INTO marcas (
      id, nome, slug, nichos, palavras_bloqueadas, preco_min, preco_max,
      amazon_tag, shopee_id, mercadolivre_tag, aliexpress_id, awin_id,
      template_mensagem, ativa, criado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    marcaPrincipalId,
    "Achados Tech & Casa",
    "achados-tech",
    "ssd, fone, monitor, cafeteira, airfryer, teclado, mouse, notebook, carregador",
    "usado, recondicionado, peca de reposicao",
    20,
    5000,
    "",
    "",
    "",
    "",
    "",
    templatePadrao,
    1,
    agora
  );

  // Fontes iniciais prontas para testar
  const fontesStmt = db.prepare(`
    INSERT INTO fontes (id, nome, tipo, url, loja_padrao, marca_id, ativa, intervalo_min, ultima_coleta, total_coletadas, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  fontesStmt.run(
    "fnt_promobit",
    "Promobit · Ofertas & Cupons ao vivo",
    "rss",
    "https://www.promobit.com.br/",
    "outra",
    marcaPrincipalId,
    1,
    10,
    null,
    0,
    agora
  );

  fontesStmt.run(
    "fnt_manual",
    "Cola Rapida / Espelhamento",
    "espelho",
    "",
    "outra",
    marcaPrincipalId,
    1,
    5,
    null,
    0,
    agora
  );

  // Salvar config padrao
  const cfgStmt = db.prepare("INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES (?, ?)");
  for (const [k, v] of Object.entries(DEFAULT_CONFIG)) {
    cfgStmt.run(k, String(v));
  }
}

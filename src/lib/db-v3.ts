import { getDb, gerarId } from "./db";

export interface GrupoCascata {
  id: string;
  campanha_slug: string;
  campanha_nome: string;
  ordem: number;
  nome_grupo: string;
  link_convite: string;
  membros_atuais: number;
  limite_membros: number;
  cliques: number;
  ativo: number;
  criado_em: string;
}

export interface CrmContato {
  id: string;
  nome: string;
  telefone: string;
  tags: string;
  desejo_produto: string;
  desejo_preco_max: number;
  status: "ativo" | "avisado" | "converteu";
  notas: string;
  criado_em: string;
}

export interface Cupom {
  id: string;
  codigo: string;
  loja: string;
  descricao: string;
  valor_minimo: number;
  status: "ativo" | "acabando" | "expirado";
  reportes_expirado: number;
  validade: string;
  criado_em: string;
}

let inicializadoV3 = false;

export function getDbV3() {
  const db = getDb();
  if (inicializadoV3) return db;

  db.exec(`
    CREATE TABLE IF NOT EXISTS grupos_cascata (
      id TEXT PRIMARY KEY,
      campanha_slug TEXT NOT NULL,
      campanha_nome TEXT NOT NULL,
      ordem INTEGER NOT NULL DEFAULT 1,
      nome_grupo TEXT NOT NULL,
      link_convite TEXT NOT NULL,
      membros_atuais INTEGER NOT NULL DEFAULT 0,
      limite_membros INTEGER NOT NULL DEFAULT 1000,
      cliques INTEGER NOT NULL DEFAULT 0,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cliques_cascata (
      id TEXT PRIMARY KEY,
      campanha_slug TEXT NOT NULL,
      grupo_id TEXT NOT NULL,
      utm_source TEXT NOT NULL DEFAULT 'direto',
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crm_contatos (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
      desejo_produto TEXT NOT NULL DEFAULT '',
      desejo_preco_max REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ativo',
      notas TEXT NOT NULL DEFAULT '',
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cupons (
      id TEXT PRIMARY KEY,
      codigo TEXT NOT NULL,
      loja TEXT NOT NULL,
      descricao TEXT NOT NULL DEFAULT '',
      valor_minimo REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ativo',
      reportes_expirado INTEGER NOT NULL DEFAULT 0,
      validade TEXT NOT NULL DEFAULT '',
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS historico_precos (
      id TEXT PRIMARY KEY,
      hash_dedup TEXT NOT NULL,
      preco REAL NOT NULL,
      criado_em TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hist_hash ON historico_precos(hash_dedup);
  `);

  seedV3(db);
  inicializadoV3 = true;
  return db;
}

function seedV3(db: ReturnType<typeof getDb>) {

  // Remove grupos ficticios de demonstracao que confundiam a lista de Meus Grupos
  db.prepare("DELETE FROM grupos_cascata WHERE id LIKE 'grp_demo%'").run();

  // Instalacao limpa: nada de contatos, cupons ou historico ficticios
  db.prepare("DELETE FROM crm_contatos WHERE id LIKE 'crm_demo%'").run();
  db.prepare("DELETE FROM cupons WHERE id LIKE 'cup_demo%'").run();
  db.prepare(
    "DELETE FROM historico_precos WHERE hash_dedup IN ('amazon:B0BBWH1R8H', 'mercadolivre:MLB22699234') AND preco IN (429.9, 349.9, 339.0, 279.0)"
  ).run();
}

export function registrarPrecoHistorico(hashDedup: string, preco: number) {
  if (!hashDedup || preco <= 0) return;
  const db = getDbV3();
  db.prepare(
    "INSERT INTO historico_precos (id, hash_dedup, preco, criado_em) VALUES (?, ?, ?, ?)"
  ).run(gerarId("hst"), hashDedup, preco, new Date().toISOString());
}

export function isMenorPrecoHistorico(hashDedup: string, precoAtual: number): boolean {
  if (!hashDedup || precoAtual <= 0) return false;
  const db = getDbV3();
  const row = db
    .prepare("SELECT MIN(preco) as menor, COUNT(*) as total FROM historico_precos WHERE hash_dedup = ?")
    .get(hashDedup) as { menor: number | null; total: number } | undefined;
  if (!row || row.total < 2 || row.menor === null) return false;
  return precoAtual <= row.menor;
}
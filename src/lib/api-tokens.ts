import crypto from "node:crypto";
import { gerarId, getDb } from "./db";

export interface ApiTokenRow {
  id: string;
  nome: string;
  token: string;
  prefixo: string;
  escopos: string;
  ultimo_uso: string | null;
  criado_em: string;
  ativo: number;
}

let inicializado = false;

export function getDbTokens() {
  const db = getDb();
  if (!inicializado) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS api_tokens (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        prefixo TEXT NOT NULL,
        escopos TEXT NOT NULL DEFAULT 'ofertas,cupons,disparar,grupos',
        ultimo_uso TEXT,
        criado_em TEXT NOT NULL,
        ativo INTEGER NOT NULL DEFAULT 1
      );
    `);
    inicializado = true;
  }
  return db;
}

export function criarTokenApi(nome: string, escopos = "ofertas,cupons,disparar,grupos"): ApiTokenRow {
  const db = getDbTokens();
  const id = gerarId("tok");
  const segredo = crypto.randomBytes(24).toString("hex");
  const token = `po_live_${segredo}`;
  const prefixo = `${token.slice(0, 14)}...${token.slice(-4)}`;
  const criadoEm = new Date().toISOString();

  db.prepare(
    `INSERT INTO api_tokens (id, nome, token, prefixo, escopos, ultimo_uso, criado_em, ativo)
     VALUES (?, ?, ?, ?, ?, NULL, ?, 1)`
  ).run(id, nome.trim() || "Token API", token, prefixo, escopos, criadoEm);

  return {
    id,
    nome: nome.trim() || "Token API",
    token,
    prefixo,
    escopos,
    ultimo_uso: null,
    criado_em: criadoEm,
    ativo: 1,
  };
}

export function listarTokensApi(): Array<Omit<ApiTokenRow, "token"> & { token_preview: string }> {
  const db = getDbTokens();
  const rows = db
    .prepare("SELECT id, nome, prefixo, escopos, ultimo_uso, criado_em, ativo FROM api_tokens WHERE ativo = 1 ORDER BY criado_em DESC")
    .all() as unknown as Array<Omit<ApiTokenRow, "token">>;
  return rows.map((r) => ({ ...r, token_preview: r.prefixo }));
}

export function revogarTokenApi(id: string): boolean {
  const db = getDbTokens();
  const res = db.prepare("DELETE FROM api_tokens WHERE id = ?").run(id);
  return res.changes > 0;
}

export function autenticarApiV1(req: Request): { ok: boolean; origem?: string } {
  // Chamadas internas do servico WhatsApp local (espelhamento)
  if (req.headers.get("x-pega-interno") === "1") {
    return { ok: true, origem: "interno" };
  }

  const db = getDbTokens();
  const auth = (req.headers.get("authorization") || "").trim();
  const xKey = (req.headers.get("x-api-key") || "").trim();
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const candidato = bearer || xKey;

  const envKey = (process.env.PEGA_OFERTA_API_KEY || "").trim();
  if (envKey && candidato === envKey) {
    return { ok: true, origem: "env" };
  }

  if (candidato) {
    const row = db
      .prepare("SELECT id, nome FROM api_tokens WHERE token = ? AND ativo = 1 LIMIT 1")
      .get(candidato) as { id: string; nome: string } | undefined;
    if (row) {
      db.prepare("UPDATE api_tokens SET ultimo_uso = ? WHERE id = ?").run(
        new Date().toISOString(),
        row.id
      );
      return { ok: true, origem: row.nome };
    }
    return { ok: false };
  }

  // Se nao houver nenhum token criado ainda e nenhuma envKey, permite acesso local para nao quebrar extensao/dev
  const totalTokens = (
    db.prepare("SELECT COUNT(*) as total FROM api_tokens WHERE ativo = 1").get() as { total: number }
  ).total;
  if (!envKey && totalTokens === 0) {
    return { ok: true, origem: "aberto_local" };
  }

  return { ok: false };
}

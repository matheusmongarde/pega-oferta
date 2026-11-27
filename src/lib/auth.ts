import crypto from "node:crypto";
import { cookies } from "next/headers";
import { gerarId, getDb, salvarConfigOperacao } from "./db";

export interface Usuario {
  id: string;
  nome: string;
  operacao: string;
  email: string;
  criado_em: string;
}

const COOKIE_NOME = "po_sessao";
let authInit = false;

function getSecret(): string {
  const db = getDb();
  const row = db
    .prepare("SELECT valor FROM configuracoes WHERE chave = 'auth_secret'")
    .get() as { valor: string } | undefined;
  if (row?.valor) return row.valor;
  const novo = crypto.randomBytes(32).toString("hex");
  db.prepare(
    "INSERT INTO configuracoes (chave, valor) VALUES ('auth_secret', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor"
  ).run(novo);
  return novo;
}

export function getDbAuth() {
  const db = getDb();
  if (!authInit) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        operacao TEXT NOT NULL DEFAULT 'Pega Oferta',
        email TEXT NOT NULL UNIQUE,
        senha_hash TEXT NOT NULL,
        criado_em TEXT NOT NULL
      );
    `);
    authInit = true;
  }
  return db;
}

function hashSenha(senha: string, salt?: string): string {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(senha, s, 64).toString("hex");
  return `${s}:${hash}`;
}

function conferirSenha(senha: string, armazenado: string): boolean {
  const [salt, hash] = armazenado.split(":");
  if (!salt || !hash) return false;
  const tentativa = crypto.scryptSync(senha, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(tentativa, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function assinarSessao(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, iat: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function lerTokenSessao(valor: string): string | null {
  const [payload, sig] = valor.split(".");
  if (!payload || !sig) return null;
  const esperado = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { uid?: string };
    return parsed.uid || null;
  } catch {
    return null;
  }
}

export function estaInstalado(): boolean {
  const db = getDbAuth();
  const row = db.prepare("SELECT COUNT(*) as total FROM usuarios").get() as { total: number };
  return row.total > 0;
}

export function criarContaInicial(dados: {
  nome: string;
  operacao: string;
  email: string;
  senha: string;
}): Usuario {
  const db = getDbAuth();
  const id = gerarId("usr");
  const email = dados.email.trim().toLowerCase();
  const operacao = dados.operacao.trim() || "Pega Oferta";
  const nome = dados.nome.trim() || "Dono";
  const criadoEm = new Date().toISOString();

  db.prepare(
    "INSERT INTO usuarios (id, nome, operacao, email, senha_hash, criado_em) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, nome, operacao, email, hashSenha(dados.senha), criadoEm);

  salvarConfigOperacao({ nome_vitrine: operacao });
  return { id, nome, operacao, email, criado_em: criadoEm };
}

export function autenticarUsuario(email: string, senha: string): Usuario | null {
  const db = getDbAuth();
  const row = db
    .prepare("SELECT * FROM usuarios WHERE email = ? LIMIT 1")
    .get(email.trim().toLowerCase()) as
    | (Usuario & { senha_hash: string })
    | undefined;
  if (!row) return null;
  if (!conferirSenha(senha, row.senha_hash)) return null;
  return {
    id: row.id,
    nome: row.nome,
    operacao: row.operacao,
    email: row.email,
    criado_em: row.criado_em,
  };
}

export function atualizarPerfilUsuario(
  userId: string,
  dados: { nome?: string; operacao?: string; email?: string }
): Usuario | null {
  const db = getDbAuth();
  const atual = db
    .prepare("SELECT id, nome, operacao, email, criado_em FROM usuarios WHERE id = ? LIMIT 1")
    .get(userId) as Usuario | undefined;
  if (!atual) return null;

  const nome = dados.nome?.trim() || atual.nome;
  const operacao = dados.operacao?.trim() || atual.operacao;
  const email = dados.email?.trim().toLowerCase() || atual.email;

  db.prepare("UPDATE usuarios SET nome = ?, operacao = ?, email = ? WHERE id = ?").run(
    nome,
    operacao,
    email,
    userId
  );
  salvarConfigOperacao({ nome_vitrine: operacao });
  return { ...atual, nome, operacao, email };
}

export function atualizarSenhaUsuario(userId: string, senhaAtual: string, novaSenha: string): boolean {
  const db = getDbAuth();
  const row = db
    .prepare("SELECT senha_hash FROM usuarios WHERE id = ? LIMIT 1")
    .get(userId) as { senha_hash: string } | undefined;
  if (!row || !conferirSenha(senhaAtual, row.senha_hash)) return false;
  db.prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?").run(hashSenha(novaSenha), userId);
  return true;
}

export function resetarContaLocal() {
  const db = getDbAuth();
  db.prepare("DELETE FROM usuarios").run();
}

export async function definirSessaoCookie(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE_NOME, assinarSessao(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function limparSessaoCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NOME);
}

export async function usuarioAtual(): Promise<Usuario | null> {
  const jar = await cookies();
  const valor = jar.get(COOKIE_NOME)?.value;
  if (!valor) return null;
  const uid = lerTokenSessao(valor);
  if (!uid) return null;
  const db = getDbAuth();
  const row = db
    .prepare("SELECT id, nome, operacao, email, criado_em FROM usuarios WHERE id = ? LIMIT 1")
    .get(uid) as Usuario | undefined;
  return row || null;
}
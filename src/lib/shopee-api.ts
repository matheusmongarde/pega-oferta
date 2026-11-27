import crypto from "node:crypto";
import { getDb } from "./db";
import type { LojaDetectada } from "./afiliado";

/**
 * Shopee Affiliate Open API (Brasil).
 * O link que credita com seguranca e o link curto (s.shopee.com.br/...) gerado pela
 * API oficial. Sem AppID/Secret o sistema cai no utm_source=an_<id>.
 * Credenciais: https://affiliate.shopee.com.br → Open API.
 */
const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";
const cache = new Map<string, string>();

function lerCfg(chave: string): string {
  const row = getDb().prepare("SELECT valor FROM configuracoes WHERE chave = ?").get(chave) as
    | { valor: string }
    | undefined;
  return (row?.valor || "").trim();
}

function gravarCfg(chave: string, valor: string) {
  getDb()
    .prepare(
      "INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor"
    )
    .run(chave, valor);
}

export function credenciaisShopee(): { appId: string; secret: string } | null {
  const appId = lerCfg("shopee_api_app_id");
  const secret = lerCfg("shopee_api_secret");
  return appId && secret ? { appId, secret } : null;
}

/** O que a tela pode ver: nunca devolve a Secret. */
export function statusShopeeApi(): { configurado: boolean; app_id: string } {
  return { configurado: Boolean(credenciaisShopee()), app_id: lerCfg("shopee_api_app_id") };
}

export function salvarCredenciaisShopee(appId: string, secret?: string) {
  gravarCfg("shopee_api_app_id", appId.trim());
  // Secret vazia mantem a atual (a tela nao recebe a Secret de volta)
  if (secret !== undefined && secret.trim()) gravarCfg("shopee_api_secret", secret.trim());
  if (!appId.trim()) gravarCfg("shopee_api_secret", "");
  cache.clear();
}

export async function gerarLinkCurtoShopee(
  originUrl: string,
  cred = credenciaisShopee()
): Promise<{ ok: true; link: string } | { ok: false; erro: string }> {
  if (!cred) return { ok: false, erro: "AppID e Secret da Shopee não configurados." };
  const emCache = cache.get(originUrl);
  if (emCache) return { ok: true, link: emCache };

  const query = `mutation{generateShortLink(input:{originUrl:${JSON.stringify(originUrl)},subIds:["pegaoferta"]}){shortLink}}`;
  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);
  const assinatura = crypto
    .createHash("sha256")
    .update(`${cred.appId}${timestamp}${payload}${cred.secret}`)
    .digest("hex");

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `SHA256 Credential=${cred.appId}, Timestamp=${timestamp}, Signature=${assinatura}`,
      },
      body: payload,
    });
    clearTimeout(t);
    const d = (await res.json().catch(() => ({}))) as {
      data?: { generateShortLink?: { shortLink?: string } };
      errors?: Array<{ message?: string }>;
    };
    const link = d.data?.generateShortLink?.shortLink;
    if (link) {
      if (cache.size > 2000) cache.clear();
      cache.set(originUrl, link);
      return { ok: true, link };
    }
    return { ok: false, erro: d.errors?.[0]?.message || `Shopee respondeu ${res.status}.` };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha ao falar com a Shopee." };
  }
}

/**
 * Passo final da troca de link: na Shopee, se tiver API configurada, troca pelo link
 * curto oficial. Se a API falhar, mantem o link com utm_source=an_<id>.
 */
export async function finalizarLinkAfiliado<
  T extends { urlAfiliado: string; loja: LojaDetectada; convertido: boolean },
>(conv: T, urlProduto: string): Promise<T> {
  if (conv.loja !== "shopee" || !credenciaisShopee()) return conv;
  let limpa = urlProduto;
  try {
    const u = new URL(urlProduto);
    for (const p of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "af_siteid", "sp_atk", "xptdk"]) {
      u.searchParams.delete(p);
    }
    limpa = u.toString();
  } catch {
    /* usa como veio */
  }
  const r = await gerarLinkCurtoShopee(limpa);
  return r.ok ? { ...conv, urlAfiliado: r.link, convertido: true } : conv;
}

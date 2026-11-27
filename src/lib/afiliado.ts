import crypto from "node:crypto";
import type { Marca } from "./db";

export type LojaDetectada =
  | "amazon"
  | "mercadolivre"
  | "shopee"
  | "aliexpress"
  | "awin"
  | "outra";

export const NOMES_LOJAS: Record<LojaDetectada, string> = {
  amazon: "Amazon",
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
  aliexpress: "AliExpress",
  awin: "Awin",
  outra: "Loja",
};

const DOMINIOS_ENCURTADORES = [
  "amzn.to",
  "a.co",
  "shope.ee",
  "s.shopee.com.br",
  "mercadolivre.com/sec",
  "meli.la",
  "s.click.aliexpress.com",
  "bit.ly",
  "tinyurl.com",
  "tidd.ly",
  "gatry.com",
];

/** Detecta a loja pelo DOMINIO do link (nao por pedaco de texto: "loja.com" nao e "a.co"). */
export function detectarLoja(urlStr: string): LojaDetectada {
  let host = "";
  try {
    host = new URL(/^https?:\/\//i.test(urlStr.trim()) ? urlStr.trim() : `https://${urlStr.trim()}`).hostname.toLowerCase();
  } catch {
    return "outra";
  }
  const eh = (...dominios: string[]) => dominios.some((d) => host === d || host.endsWith(`.${d}`));
  if (eh("amazon.com.br", "amazon.com", "amzn.to", "amzn.com", "a.co")) return "amazon";
  if (eh("mercadolivre.com.br", "mercadolivre.com", "mercadolibre.com", "meli.la")) return "mercadolivre";
  if (eh("shopee.com.br", "shopee.com", "shope.ee")) return "shopee";
  if (eh("aliexpress.com", "aliexpress.us")) return "aliexpress";
  if (eh("awin1.com", "tidd.ly")) return "awin";
  return "outra";
}

export async function desencurtarUrl(urlInicial: string): Promise<string> {
  const limpa = urlInicial.trim();
  if (!/^https?:\/\//i.test(limpa)) return limpa;

  const precisaExpandir = DOMINIOS_ENCURTADORES.some((d) =>
    limpa.toLowerCase().includes(d)
  );
  if (!precisaExpandir) return limpa;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(limpa, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
      },
    });
    clearTimeout(timer);
    return res.url || limpa;
  } catch {
    return limpa;
  }
}

export function extrairHashDedup(urlStr: string, tituloFallback = ""): string {
  const loja = detectarLoja(urlStr);

  // Amazon ASIN
  if (loja === "amazon") {
    const m = urlStr.match(/(?:\/dp\/|\/gp\/product\/|\/product\/)([A-Z0-9]{10})/i);
    if (m) return `amazon:${m[1].toUpperCase()}`;
  }

  // Mercado Livre MLB ID
  if (loja === "mercadolivre") {
    const m = urlStr.match(/(MLB-?\d{7,14})/i);
    if (m) return `mercadolivre:${m[1].replace("-", "").toUpperCase()}`;
  }

  // Shopee item ID
  if (loja === "shopee") {
    const m =
      urlStr.match(/-i\.(\d+)\.(\d+)/) ||
      urlStr.match(/\/product\/(\d+)\/(\d+)/);
    if (m) return `shopee:${m[2]}`;
  }

  // AliExpress item ID
  if (loja === "aliexpress") {
    const m = urlStr.match(/\/item\/(\d+)\.html/);
    if (m) return `aliexpress:${m[1]}`;
  }

  // Fallback por URL limpa (sem query) ou titulo normalizado
  try {
    const u = new URL(urlStr);
    const base = `${u.hostname}${u.pathname}`.toLowerCase().replace(/\/+$/, "");
    const digest = crypto.createHash("sha1").update(base).digest("hex").slice(0, 12);
    return `${loja}:${digest}`;
  } catch {
    const norm = tituloFallback
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .slice(0, 60);
    const digest = crypto.createHash("sha1").update(norm || urlStr).digest("hex").slice(0, 12);
    return `${loja}:${digest}`;
  }
}

const TAGS_PLACEHOLDER = new Set([
  "suatag-20",
  "sua_tag_ml",
  "seu_id_shopee",
  "seu_id_aliexpress",
  "seu_id_awin",
  "pegaoferta-20",
]);

export function tagValida(valor?: string | null): string {
  const limpa = (valor || "").trim();
  if (!limpa || TAGS_PLACEHOLDER.has(limpa.toLowerCase())) return "";
  return limpa;
}

/**
 * Tag do Mercado Livre. O link oficial do Gerador de Links leva DOIS parametros:
 * matt_word (seu usuario de afiliado) e matt_tool (o ID da ferramenta/conta).
 * So o matt_tool nao identifica a conta. Aceita:
 *  - "usuario:12345678" (formato salvo)
 *  - "matt:usuario:12345678"
 *  - o link longo inteiro gerado pelo ML (com matt_word= e matt_tool=)
 *  - so um dos dois (fica marcado como incompleto)
 */
export function lerTagMercadoLivre(valor?: string | null): {
  word: string;
  tool: string;
  completa: boolean;
} {
  const limpa = tagValida(valor);
  let word = "";
  let tool = "";
  if (/matt_(word|tool)=/i.test(limpa)) {
    try {
      const u = new URL(limpa.startsWith("http") ? limpa : `https://x.com/?${limpa.replace(/^.*\?/, "")}`);
      word = (u.searchParams.get("matt_word") || "").trim();
      tool = (u.searchParams.get("matt_tool") || "").trim();
    } catch {
      /* segue vazio */
    }
  } else if (limpa.includes(":")) {
    const partes = limpa.split(":").map((x) => x.trim()).filter(Boolean);
    if (partes[0]?.toLowerCase() === "matt") partes.shift();
    word = partes[0] || "";
    tool = partes[1] || "";
  } else if (/^\d+$/.test(limpa)) {
    tool = limpa;
  } else {
    word = limpa;
  }
  return { word, tool, completa: Boolean(word && tool) };
}

/** Formato salvo no banco: "usuario:id". */
export function normalizarTagMercadoLivre(valor?: string | null): string {
  const t = lerTagMercadoLivre(valor);
  if (t.word && t.tool) return `${t.word}:${t.tool}`;
  return t.word || t.tool;
}

export function converterLinkAfiliado(
  urlExpandida: string,
  marca: Pick<
    Marca,
    "amazon_tag" | "shopee_id" | "mercadolivre_tag" | "aliexpress_id" | "awin_id"
  >
): { urlAfiliado: string; loja: LojaDetectada; convertido: boolean } {
  const loja = detectarLoja(urlExpandida);

  try {
    const u = new URL(urlExpandida);

    // Limpa parametros de rastreio de terceiros
    const remover = [
      "tag",
      "ref",
      "ref_",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "fbclid",
      "gclid",
      "matt_tool",
      "matt_word",
      "af_siteid",
      "aff_fcid",
      "aff_fsk",
      "aff_platform",
      "sk",
    ];
    for (const p of remover) u.searchParams.delete(p);

    const amz = tagValida(marca.amazon_tag);
    const ml = tagValida(marca.mercadolivre_tag);
    const shp = tagValida(marca.shopee_id);
    const ali = tagValida(marca.aliexpress_id);
    const awin = tagValida(marca.awin_id);

    if (loja === "amazon" && amz) {
      const m = urlExpandida.match(/(?:\/dp\/|\/gp\/product\/)([A-Z0-9]{10})/i);
      const urlLimpa = m
        ? `https://www.amazon.com.br/dp/${m[1].toUpperCase()}?tag=${encodeURIComponent(amz)}`
        : (() => {
            u.searchParams.set("tag", amz);
            return u.toString();
          })();
      return { urlAfiliado: urlLimpa, loja, convertido: true };
    }

    if (loja === "mercadolivre" && ml) {
      const t = lerTagMercadoLivre(ml);
      if (t.word) u.searchParams.set("matt_word", t.word);
      if (t.tool) u.searchParams.set("matt_tool", t.tool);
      return { urlAfiliado: u.toString(), loja, convertido: t.completa };
    }

    if (loja === "shopee" && shp) {
      u.searchParams.set("utm_source", `an_${shp}`);
      u.searchParams.set("utm_medium", "affiliates");
      return { urlAfiliado: u.toString(), loja, convertido: true };
    }

    // AliExpress Portals: a chave da conta (aff_short_key) vai no deep link oficial
    // s.click.aliexpress.com/deep_link.htm apontando pro produto limpo.
    if (loja === "aliexpress" && ali) {
      const m = urlExpandida.match(/\/item\/(\d+)\.html/);
      const alvo = m ? `https://pt.aliexpress.com/item/${m[1]}.html` : `${u.origin}${u.pathname}`;
      return {
        urlAfiliado: `https://s.click.aliexpress.com/deep_link.htm?aff_short_key=${encodeURIComponent(
          ali
        )}&dl_target_url=${encodeURIComponent(alvo)}`,
        loja,
        convertido: true,
      };
    }

    // Awin: o link ja traz o ID da loja (awinmid). Mantem a loja e troca so o
    // afiliado (awinaffid) pelo seu Publisher ID.
    if (awin && loja === "awin") {
      const awinOriginal = new URL(urlExpandida);
      const mid = awinOriginal.searchParams.get("awinmid") || awinOriginal.searchParams.get("mid");
      const destino = awinOriginal.searchParams.get("ued") || awinOriginal.searchParams.get("p");
      if (mid && destino && /awin1\.com$/i.test(awinOriginal.hostname)) {
        return {
          urlAfiliado: `https://www.awin1.com/cread.php?awinmid=${encodeURIComponent(
            mid
          )}&awinaffid=${encodeURIComponent(awin)}&ued=${encodeURIComponent(destino)}`,
          loja,
          convertido: true,
        };
      }
      return { urlAfiliado: urlExpandida, loja, convertido: false };
    }

    return { urlAfiliado: u.toString(), loja, convertido: false };
  } catch {
    return { urlAfiliado: urlExpandida, loja, convertido: false };
  }
}

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

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
  "awin1.com",
  "gatry.com",
];

export function detectarLoja(urlStr: string): LojaDetectada {
  const lower = urlStr.toLowerCase();
  if (lower.includes("amazon.com") || lower.includes("amzn.to") || lower.includes("a.co")) {
    return "amazon";
  }
  if (
    lower.includes("mercadolivre.com") ||
    lower.includes("mercadolibre.com") ||
    lower.includes("meli.la")
  ) {
    return "mercadolivre";
  }
  if (lower.includes("shopee.com") || lower.includes("shope.ee")) {
    return "shopee";
  }
  if (lower.includes("aliexpress.com") || lower.includes("aliexpress.us")) {
    return "aliexpress";
  }
  if (lower.includes("awin1.com") || lower.includes("tidd.ly")) {
    return "awin";
  }
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
      u.searchParams.set("matt_tool", ml);
      return { urlAfiliado: u.toString(), loja, convertido: true };
    }

    if (loja === "shopee" && shp) {
      u.searchParams.set("utm_source", `an_${shp}`);
      u.searchParams.set("utm_medium", "affiliates");
      return { urlAfiliado: u.toString(), loja, convertido: true };
    }

    if (loja === "aliexpress" && ali) {
      u.searchParams.set("aff_platform", "portals-tool");
      u.searchParams.set("aff_short_key", ali);
      return { urlAfiliado: u.toString(), loja, convertido: true };
    }

    if (awin && loja === "awin") {
      return {
        urlAfiliado: `https://www.awin1.com/cread.php?awinmid=0&awinaffid=${encodeURIComponent(
          awin
        )}&ued=${encodeURIComponent(u.toString())}`,
        loja,
        convertido: true,
      };
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

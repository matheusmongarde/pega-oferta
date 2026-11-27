import {
  getConfigOperacao,
  getDb,
  gerarId,
  type Fonte,
  type Marca,
} from "./db";
import {
  converterLinkAfiliado,
  desencurtarUrl,
  extrairHashDedup,
  type LojaDetectada,
} from "./afiliado";
import { extrairCupom, extrairPrecos, limparTituloOferta } from "./parser";
import { extrairMetadadosUrl, registrarCupomAutomatico } from "./scraper-og";
import { registrarPrecoHistorico } from "./db-v3";

export interface ResultadoColeta {
  fonte_id: string;
  fonte_nome: string;
  lidas: number;
  novas: number;
  duplicadas: number;
  filtradas: number;
  cupons?: number;
  erro?: string;
}

function limparHtml(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairTagXml(bloco: string, tag: string): string {
  const m = bloco.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? limparHtml(m[1]) : "";
}

function extrairImagemXml(bloco: string): string {
  const m =
    bloco.match(/<enclosure[^>]+url=["']([^"']+)["']/i) ||
    bloco.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
    bloco.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : "";
}

function mapearLojaPorDominio(dominio?: string | null, nome?: string | null): LojaDetectada {
  const s = `${dominio || ""} ${nome || ""}`.toLowerCase();
  if (s.includes("amazon")) return "amazon";
  if (s.includes("mercadolivre") || s.includes("mercadolibre") || s.includes("mercado livre"))
    return "mercadolivre";
  if (s.includes("shopee")) return "shopee";
  if (s.includes("aliexpress")) return "aliexpress";
  if (s.includes("magalu") || s.includes("magazineluiza") || s.includes("kabum") || s.includes("nike") || s.includes("netshoes"))
    return "awin";
  return "outra";
}

function passaNosFiltros(
  titulo: string,
  preco: number,
  marca: Marca
): boolean {
  const lower = titulo.toLowerCase();
  const bloqueadas = marca.palavras_bloqueadas
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (bloqueadas.some((b) => lower.includes(b))) {
    return false;
  }
  if (preco > 0) {
    if (marca.preco_min > 0 && preco < marca.preco_min) return false;
    if (marca.preco_max > 0 && preco > marca.preco_max) return false;
  }
  return true;
}

const hashesEmVoo = new Set<string>();

function normalizarTituloDedup(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function jaExisteRecente(
  hashDedup: string,
  titulo?: string,
  urlOriginal?: string
): boolean {
  if (hashesEmVoo.has(hashDedup)) return true;

  const db = getDb();

  // 1. Mesmo hash_dedup nunca duplica (evita reimportar itens antigos de RSS/Promobit)
  const porHash = db
    .prepare("SELECT id FROM ofertas WHERE hash_dedup = ? LIMIT 1")
    .get(hashDedup) as { id: string } | undefined;
  if (porHash) return true;

  // 2. Mesma URL original exata nunca duplica
  if (urlOriginal && urlOriginal.length > 15 && urlOriginal !== "https://www.promobit.com.br/") {
    const porUrl = db
      .prepare("SELECT id FROM ofertas WHERE url_original = ? LIMIT 1")
      .get(urlOriginal) as { id: string } | undefined;
    if (porUrl) return true;
  }

  // 3. Mesmo titulo entre fontes diferentes dentro da janela de deduplicacao
  if (titulo) {
    const norm = normalizarTituloDedup(titulo);
    if (norm.length >= 12) {
      const chaveTitulo = `t:${norm}`;
      if (hashesEmVoo.has(chaveTitulo)) return true;
      const cfg = getConfigOperacao();
      const limiteIso = new Date(
        Date.now() - Math.max(24, cfg.janela_dedup_horas) * 3600 * 1000
      ).toISOString();
      const porTitulo = db
        .prepare("SELECT id FROM ofertas WHERE LOWER(TRIM(titulo)) = ? AND criado_em >= ? LIMIT 1")
        .get(titulo.trim().toLowerCase(), limiteIso) as { id: string } | undefined;
      if (porTitulo) return true;
    }
  }

  return false;
}

function reservarDedup(hashDedup: string, titulo?: string): () => void {
  const chaves = [hashDedup];
  if (titulo) {
    const norm = normalizarTituloDedup(titulo);
    if (norm.length >= 12) chaves.push(`t:${norm}`);
  }
  for (const c of chaves) hashesEmVoo.add(c);
  return () => {
    for (const c of chaves) hashesEmVoo.delete(c);
  };
}

interface PromobitOffer {
  offerId?: number;
  offerTitle?: string;
  offerPrice?: number;
  offerOldPrice?: number;
  offerDiscontPercentage?: number;
  offerCoupon?: string | null;
  offerPhoto?: string;
  offerSlug?: string;
  storeName?: string;
  storeDomain?: string;
  offerPublished?: string;
}

interface PromobitCoupon {
  couponCode?: string | null;
  couponDiscount?: string | null;
  couponTitle?: string | null;
  couponInstructions?: string | null;
  storeName?: string | null;
  storeDomain?: string | null;
}

async function coletarPromobit(fonte: Fonte, marca: Marca): Promise<ResultadoColeta> {
  const db = getDb();
  const res: ResultadoColeta = {
    fonte_id: fonte.id,
    fonte_nome: fonte.nome,
    lidas: 0,
    novas: 0,
    duplicadas: 0,
    filtradas: 0,
    cupons: 0,
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(fonte.url || "https://www.promobit.com.br/", {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      res.erro = `Promobit retornou HTTP ${response.status}.`;
      return res;
    }

    const html = await response.text();
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
      res.erro = "Estrutura de dados do Promobit nao encontrada.";
      return res;
    }

    const json = JSON.parse(match[1]) as {
      props?: {
        pageProps?: {
          serverOffers?: { offers?: PromobitOffer[] };
          serverFeaturedOffers?: PromobitOffer[];
          serverCoupons?: PromobitCoupon[];
          coupons?: PromobitCoupon[];
          initialCoupons?: PromobitCoupon[];
        };
      };
    };

    const pp = json.props?.pageProps || {};
    const cuponsPromobit: PromobitCoupon[] = [
      ...(pp.serverCoupons || []),
      ...(pp.coupons || []),
      ...(pp.initialCoupons || []),
    ];
    const brutas: PromobitOffer[] = [
      ...(pp.serverOffers?.offers || []),
      ...(pp.serverFeaturedOffers || []),
    ];

    // Deduplica por offerId dentro da mesma coleta
    const vistas = new Set<number>();
    const lista = brutas
      .filter((o) => {
        if (!o.offerTitle || !o.offerId || vistas.has(o.offerId)) return false;
        vistas.add(o.offerId);
        return true;
      })
      .slice(0, 24);

    res.lidas = lista.length;

    const insertStmt = db.prepare(`
      INSERT INTO ofertas (
        id, marca_id, fonte_id, titulo, loja, preco, preco_antigo, desconto_pct,
        cupom, url_original, url_afiliado, imagem_url, hash_dedup, status,
        cliques, exemplo, origem_label, texto_original, criado_em, enviada_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nova', 0, 0, ?, ?, ?, NULL)
    `);

    for (const o of lista) {
      const titulo = limparTituloOferta(o.offerTitle || "").slice(0, 140);
      const preco = Number(o.offerPrice) || 0;
      const oldRaw = Number(o.offerOldPrice) || 0;
      const precoAntigo = oldRaw > preco && preco > 0 ? oldRaw : null;
      const descontoPct =
        o.offerDiscontPercentage && o.offerDiscontPercentage > 0
          ? Math.round(o.offerDiscontPercentage)
          : precoAntigo && preco > 0
          ? Math.round(((precoAntigo - preco) / precoAntigo) * 100)
          : null;

      if (!passaNosFiltros(titulo, preco, marca)) {
        res.filtradas++;
        continue;
      }

      const urlOriginal = o.offerSlug
        ? `https://www.promobit.com.br/oferta/${o.offerSlug}/`
        : "https://www.promobit.com.br/";
      const hashDedup = `promobit:${o.offerId}`;

      if (jaExisteRecente(hashDedup, titulo, urlOriginal)) {
        res.duplicadas++;
        continue;
      }
      const liberarPromobit = reservarDedup(hashDedup, titulo);

      const lojaFinal = mapearLojaPorDominio(o.storeDomain, o.storeName);
      const imagem = o.offerPhoto
        ? o.offerPhoto.startsWith("http")
          ? o.offerPhoto
          : `https://i.promobit.com.br${o.offerPhoto}`
        : "";
      const cupom = (o.offerCoupon || "").trim().toUpperCase();
      const conv = converterLinkAfiliado(urlOriginal, marca);
      const criadoEm =
        o.offerPublished && !Number.isNaN(Date.parse(o.offerPublished))
          ? new Date(o.offerPublished).toISOString()
          : new Date().toISOString();
      const origemLabel = o.storeName ? `Promobit · ${o.storeName}` : "Promobit";

      insertStmt.run(
        gerarId("ofr"),
        marca.id,
        fonte.id,
        titulo,
        lojaFinal,
        preco,
        precoAntigo,
        descontoPct,
        cupom,
        urlOriginal,
        conv.urlAfiliado,
        imagem,
        hashDedup,
        origemLabel,
        `${titulo} — ${o.storeName || ""}`.slice(0, 300),
        criadoEm
      );

      if (cupom) {
        registrarCupomAutomatico(cupom, lojaFinal, titulo);
        res.cupons = (res.cupons || 0) + 1;
      }
      if (preco > 0) registrarPrecoHistorico(hashDedup, preco);
      res.novas++;
      if (typeof liberarPromobit === 'function') liberarPromobit();
    }

    // Importa tambem os cupons reais do Promobit direto no Radar de Cupons
    for (const c of cuponsPromobit) {
      const cod = (c.couponCode || "").trim().toUpperCase();
      if (!cod || cod.length < 3) continue;
      const lojaCup = mapearLojaPorDominio(c.storeDomain, c.storeName);
      const desc =
        c.couponDiscount || c.couponTitle || c.couponInstructions || `Cupom ${c.storeName || ""}`;
      registrarCupomAutomatico(cod, lojaCup, `${c.storeName ? `${c.storeName} · ` : ""}${desc}`);
      res.cupons = (res.cupons || 0) + 1;
    }

    db.prepare(
      "UPDATE fontes SET ultima_coleta = ?, total_coletadas = total_coletadas + ? WHERE id = ?"
    ).run(new Date().toISOString(), res.novas, fonte.id);

    return res;
  } catch (err) {
    res.erro = err instanceof Error ? err.message : "Erro ao coletar Promobit.";
    return res;
  }
}

async function coletarAwinPromotions(fonte: Fonte, marca: Marca): Promise<ResultadoColeta> {
  const res: ResultadoColeta = {
    fonte_id: fonte.id,
    fonte_nome: fonte.nome,
    lidas: 0,
    novas: 0,
    duplicadas: 0,
    filtradas: 0,
    cupons: 0,
  };
  const cfg = getConfigOperacao();
  const token = (cfg.awin_api_token || process.env.AWIN_API_TOKEN || "").trim();
  if (!token) {
    res.erro = "Informe seu Awin API Token na Biblioteca de Fontes para sincronizar a Awin.";
    return res;
  }
  try {
    const response = await fetch(fonte.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filters: { status: "active" }, pagination: { page: 1, pageSize: 50 } }),
    });
    if (!response.ok) {
      res.erro = `Awin API retornou HTTP ${response.status}.`;
      return res;
    }
    const json = (await response.json()) as {
      data?: Array<{
        title?: string;
        description?: string;
        voucher?: { code?: string };
        advertiser?: { name?: string };
        urlTracking?: string;
      }>;
    };
    const itens = json.data || [];
    res.lidas = itens.length;
    for (const it of itens) {
      const code = (it.voucher?.code || "").trim().toUpperCase();
      if (code) {
        registrarCupomAutomatico(
          code,
          "awin",
          `${it.advertiser?.name ? `${it.advertiser.name} · ` : ""}${it.title || it.description || "Cupom Awin"}`
        );
        res.cupons = (res.cupons || 0) + 1;
      }
    }
    const db = getDb();
    db.prepare(
      "UPDATE fontes SET ultima_coleta = ?, total_coletadas = total_coletadas + ? WHERE id = ?"
    ).run(new Date().toISOString(), res.cupons || 0, fonte.id);
    return res;
  } catch (err) {
    res.erro = err instanceof Error ? err.message : "Erro ao consultar Awin API.";
    return res;
  }
}

export async function coletarFonteRss(fonte: Fonte): Promise<ResultadoColeta> {
  const db = getDb();
  const res: ResultadoColeta = {
    fonte_id: fonte.id,
    fonte_nome: fonte.nome,
    lidas: 0,
    novas: 0,
    duplicadas: 0,
    filtradas: 0,
  };

  if (!fonte.url) {
    res.erro = "Fonte sem URL configurada.";
    return res;
  }

  const marca = db
    .prepare("SELECT * FROM marcas WHERE id = ?")
    .get(fonte.marca_id) as Marca | undefined;
  if (!marca) {
    res.erro = "Marca vinculada nao encontrada.";
    return res;
  }

  // Roteamento automatico para Promobit (ofertas + cupons ao vivo) e Awin Promotions API
  if (/promobit\.com\.br/i.test(fonte.url)) {
    return coletarPromobit(fonte, marca);
  }
  if (/api\.awin\.com\/publisher\//i.test(fonte.url)) {
    return coletarAwinPromotions(fonte, marca);
  }

  if (fonte.tipo !== "rss") {
    res.erro = "Tipo de fonte nao suporta coleta HTTP.";
    return res;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(fonte.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "pega-oferta/1.0 (+https://github.com/pega-oferta)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      res.erro = `HTTP ${response.status} ao ler o feed.`;
      return res;
    }

    const xml = await response.text();
    const itens = xml.match(/<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi) || [];
    const limiteItens = itens.slice(0, 15);
    res.lidas = limiteItens.length;

    const insertStmt = db.prepare(`
      INSERT INTO ofertas (
        id, marca_id, fonte_id, titulo, loja, preco, preco_antigo, desconto_pct,
        cupom, url_original, url_afiliado, imagem_url, hash_dedup, status,
        cliques, exemplo, origem_label, texto_original, criado_em, enviada_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nova', 0, 0, ?, ?, ?, NULL)
    `);

    for (const bloco of limiteItens) {
      const titulo = limparTituloOferta(extrairTagXml(bloco, "title"));
      const descricao =
        extrairTagXml(bloco, "description") || extrairTagXml(bloco, "summary");
      let link = extrairTagXml(bloco, "link");
      if (!link) {
        const hrefMatch = bloco.match(/<link[^>]+href=["']([^"']+)["']/i);
        if (hrefMatch) link = hrefMatch[1];
      }
      if (!titulo || !link) continue;

      const textoCombinado = `${titulo}\n${descricao}`;
      const { preco, precoAntigo, descontoPct } = extrairPrecos(textoCombinado);
      const cupom = extrairCupom(textoCombinado);
      let imagem = extrairImagemXml(bloco);

      if (!passaNosFiltros(titulo, preco, marca)) {
        res.filtradas++;
        continue;
      }

      const urlExpandida = await desencurtarUrl(link);
      if (!imagem) {
        const meta = await extrairMetadadosUrl(urlExpandida);
        imagem = meta.imagemUrl;
      }
      const hashDedup = extrairHashDedup(urlExpandida, titulo);

      if (jaExisteRecente(hashDedup, titulo, urlExpandida)) {
        res.duplicadas++;
        continue;
      }
      const liberarRss = reservarDedup(hashDedup, titulo);

      const conv = converterLinkAfiliado(urlExpandida, marca);
      const lojaFinal =
        conv.loja === "outra" && fonte.loja_padrao ? fonte.loja_padrao : conv.loja;

      const pubDate = extrairTagXml(bloco, "pubDate") || extrairTagXml(bloco, "updated");
      const criadoEm =
        pubDate && !Number.isNaN(Date.parse(pubDate))
          ? new Date(pubDate).toISOString()
          : new Date().toISOString();

      insertStmt.run(
        gerarId("ofr"),
        marca.id,
        fonte.id,
        titulo.slice(0, 140),
        lojaFinal,
        preco,
        precoAntigo,
        descontoPct,
        cupom,
        urlExpandida,
        conv.urlAfiliado,
        imagem,
        hashDedup,
        fonte.nome,
        textoCombinado.slice(0, 500),
        criadoEm
      );
      if (cupom) registrarCupomAutomatico(cupom, lojaFinal, titulo);
      if (preco > 0) registrarPrecoHistorico(hashDedup, preco);
      res.novas++;
      if (typeof liberarRss === 'function') liberarRss();
    }

    db.prepare(
      "UPDATE fontes SET ultima_coleta = ?, total_coletadas = total_coletadas + ? WHERE id = ?"
    ).run(new Date().toISOString(), res.novas, fonte.id);

    return res;
  } catch (err) {
    res.erro = err instanceof Error ? err.message : "Erro ao coletar feed.";
    return res;
  }
}

import {
  converterLinkAfiliado,
  desencurtarUrl,
  extrairHashDedup,
  formatarMoeda,
  NOMES_LOJAS,
  type LojaDetectada,
} from "./afiliado";
import type { Marca } from "./db";
import { extrairMetadadosUrl } from "./scraper-og";
import { finalizarLinkAfiliado } from "./shopee-api";

export interface OfertaParseada {
  titulo: string;
  loja: LojaDetectada;
  preco: number;
  preco_antigo: number | null;
  desconto_pct: number | null;
  cupom: string;
  url_original: string;
  url_afiliado: string;
  imagem_url: string;
  convertido: boolean;
  hash_dedup: string;
  preview_mensagem: string;
}

function parseNumeroBR(str: string): number {
  const limpo = str.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

export function extrairPrecos(texto: string): {
  preco: number;
  precoAntigo: number | null;
  descontoPct: number | null;
} {
  const regex = /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/gi;
  const encontrados: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(texto)) !== null) {
    const val = parseNumeroBR(match[1]);
    if (val > 0) encontrados.push(val);
  }

  if (encontrados.length === 0) {
    return { preco: 0, precoAntigo: null, descontoPct: null };
  }

  if (encontrados.length === 1) {
    return { preco: encontrados[0], precoAntigo: null, descontoPct: null };
  }

  // Se houver "de R$ X por R$ Y", o maior normalmente e o antigo e o menor o atual
  const sorted = [...encontrados].sort((a, b) => a - b);
  const preco = sorted[0];
  const precoAntigo = sorted[sorted.length - 1];
  const descontoPct =
    precoAntigo > preco
      ? Math.round(((precoAntigo - preco) / precoAntigo) * 100)
      : null;

  return {
    preco,
    precoAntigo: precoAntigo > preco ? precoAntigo : null,
    descontoPct,
  };
}

export function extrairCupom(texto: string): string {
  const padroes = [
    /\b(?:cupom|código|codigo|use\s+o\s+cupom|aplicar)\s*[:\-]?\s*[`"']?([A-Z0-9]{4,20})[`"']?/i,
    /🏷️?\s*([A-Z0-9]{5,18})\b/,
  ];
  for (const r of padroes) {
    const m = texto.match(r);
    if (m && m[1] && !/^(DE|POR|PARA|COM|LINK|LOJA|OFERTA|GRATIS)$/i.test(m[1])) {
      return m[1].toUpperCase();
    }
  }
  return "";
}

export function extrairUrl(texto: string): string {
  const m = texto.match(/https?:\/\/[^\s<>()]+/i);
  return m ? m[0].replace(/[.,;!?]+$/, "") : "";
}

export function limparTituloOferta(raw: string): string {
  return (raw || "")
    .replace(/[\uFE0F\u200D]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[*_~`]/g, "")
    .replace(/^[\s•\-–—|\]>]+|[\s•\-–—|\[]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function limparUrlPlaceholder(urlStr: string): string {
  if (!urlStr) return "";
  try {
    const u = new URL(urlStr);
    const placeholders = new Set([
      "suatag-20",
      "sua_tag_ml",
      "an_seu_id_shopee",
      "seu_id_shopee",
      "seu_id_aliexpress",
      "seu_id_awin",
      "pegaoferta-20",
    ]);
    for (const [k, v] of Array.from(u.searchParams.entries())) {
      if (placeholders.has(v.toLowerCase())) {
        u.searchParams.delete(k);
      }
    }
    return u.toString();
  } catch {
    return urlStr;
  }
}

export function extrairTitulo(texto: string): string {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => limparTituloOferta(l.replace(/https?:\/\/\S+/gi, "")))
    .filter((l) => l.length >= 6);

  const candidata =
    linhas.find(
      (l) =>
        !/^(de\s+r\$|por\s+r\$|r\$|cupom|use\s+o\s+cupom|compre\s+aqui|link|loja)/i.test(
          l
        )
    ) ||
    linhas[0] ||
    "Oferta sem titulo";

  // Remove trechos de preco colados no fim da linha
  const limpa = candidata
    .replace(/\s*(?:de\s+)?R\$\s*[\d.,]+.*$/i, "")
    .replace(/\s*cupom\s*:?.*$/i, "")
    .trim();

  const finalStr = limpa.length >= 4 ? limpa : candidata;
  // Se estiver tudo em caixa alta, normaliza capitalizacao
  if (finalStr === finalStr.toUpperCase() && finalStr.length > 10) {
    return finalStr.charAt(0).toUpperCase() + finalStr.slice(1).toLowerCase();
  }
  return finalStr.slice(0, 140);
}

export function formatarMensagemOferta(
  oferta: {
    titulo: string;
    loja: string;
    preco: number;
    preco_antigo: number | null;
    desconto_pct: number | null;
    cupom: string;
    url_afiliado: string;
    imagem_url: string;
  },
  template: string,
  extras?: { marca?: string; vitrine?: string }
): string {
  const nomeLoja =
    NOMES_LOJAS[(oferta.loja as LojaDetectada) || "outra"] || oferta.loja;

  const temAntigo = Boolean(
    oferta.preco > 0 && oferta.preco_antigo && oferta.preco_antigo > oferta.preco
  );
  const economiaVal = temAntigo && oferta.preco_antigo ? oferta.preco_antigo - oferta.preco : 0;
  const economiaFmt = economiaVal > 0 ? formatarMoeda(economiaVal) : "";
  const parcelasFmt =
    oferta.preco >= 100 ? `10x de ${formatarMoeda(oferta.preco / 10)} sem juros` : "";

  let blocoPreco = "";
  if (temAntigo && oferta.preco_antigo) {
    const desc = oferta.desconto_pct ? ` (-${oferta.desconto_pct}%)` : "";
    blocoPreco = `De ~${formatarMoeda(oferta.preco_antigo)}~ por *${formatarMoeda(
      oferta.preco
    )}*${desc}`;
  } else if (oferta.preco > 0) {
    blocoPreco = `Por *${formatarMoeda(oferta.preco)}*`;
  }

  const blocoCupom = oferta.cupom ? `🏷️ Cupom: \`${oferta.cupom}\`` : "";
  const tituloLimpo = limparTituloOferta(oferta.titulo) || oferta.titulo;
  const linkLimpo = limparUrlPlaceholder(oferta.url_afiliado);

  const mapa: Record<string, string> = {
    "{{titulo}}": tituloLimpo,
    "{{preco}}": oferta.preco > 0 ? formatarMoeda(oferta.preco) : "",
    "{{preco_antigo}}": temAntigo && oferta.preco_antigo ? formatarMoeda(oferta.preco_antigo) : "",
    "{{desconto}}": oferta.desconto_pct ? `${oferta.desconto_pct}%` : "",
    "{{economia}}": economiaFmt,
    "{{parcelas}}": parcelasFmt,
    "{{cupom}}": oferta.cupom || "",
    "{{loja}}": nomeLoja,
    "{{link}}": linkLimpo,
    "{{bloco_preco}}": blocoPreco,
    "{{bloco_cupom}}": blocoCupom,
    "{{marca}}": extras?.marca || "",
    "{{vitrine}}": extras?.vitrine || "",
  };

  // Processa linha por linha: se uma linha continha variaveis opcionais que ficaram vazias, remove a linha inteira para nao deixar lixo visual
  const linhas = template.split(/\r?\n/);
  const saida: string[] = [];
  for (const linha of linhas) {
    const varsNaLinha = linha.match(/\{\{[a-z_]+\}\}/g) || [];
    let substituida = linha;
    for (const [k, v] of Object.entries(mapa)) {
      substituida = substituida.replaceAll(k, v);
    }
    if (varsNaLinha.length > 0) {
      const algumaPreenchida = varsNaLinha.some((v) => Boolean(mapa[v]));
      if (!algumaPreenchida) continue;
    }
    saida.push(substituida.replace(/[ \t]+$/g, ""));
  }

  return saida.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function parsearTextoOferta(
  textoBruto: string,
  marca: Marca
): Promise<OfertaParseada> {
  const urlEncontrada = extrairUrl(textoBruto);
  const urlExpandida = urlEncontrada ? await desencurtarUrl(urlEncontrada) : "";
  const meta = urlExpandida ? await extrairMetadadosUrl(urlExpandida) : { imagemUrl: "", tituloPagina: "" };
  const { preco, precoAntigo, descontoPct } = extrairPrecos(textoBruto);
  const cupom = extrairCupom(textoBruto);
  const tituloExtraido = extrairTitulo(textoBruto);
  const titulo = tituloExtraido === "Oferta sem titulo" && meta.tituloPagina ? meta.tituloPagina.slice(0, 140) : tituloExtraido;

  const conv = urlExpandida
    ? await finalizarLinkAfiliado(converterLinkAfiliado(urlExpandida, marca), urlExpandida)
    : { urlAfiliado: "", loja: "outra" as LojaDetectada, convertido: false };

  const hashDedup = extrairHashDedup(urlExpandida || titulo, titulo);

  const preview = formatarMensagemOferta(
    {
      titulo,
      loja: conv.loja,
      preco,
      preco_antigo: precoAntigo,
      desconto_pct: descontoPct,
      cupom,
      url_afiliado: conv.urlAfiliado || urlEncontrada,
    imagem_url: meta.imagemUrl,
    },
    marca.template_mensagem
  );

  return {
    titulo,
    loja: conv.loja,
    preco,
    preco_antigo: precoAntigo,
    desconto_pct: descontoPct,
    cupom,
    url_original: urlExpandida || urlEncontrada,
    url_afiliado: conv.urlAfiliado || urlEncontrada,
    imagem_url: meta.imagemUrl,
    convertido: conv.convertido,
    hash_dedup: hashDedup,
    preview_mensagem: preview,
  };
}

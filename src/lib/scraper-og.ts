import { gerarId } from "./db";
import { getDbV3 } from "./db-v3";

export interface MetadadosProduto {
  imagemUrl: string;
  tituloPagina: string;
  precoAtual: number;
  precoAntigo: number;
}

function parseNumeroPreco(raw: string): number {
  const limpo = raw.trim().replace(/[^\d.,]/g, "");
  if (!limpo) return 0;
  // Se tem virgula como decimal (BR: 1.299,90)
  if (/,\d{1,2}$/.test(limpo)) {
    const n = Number(limpo.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(limpo.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export async function extrairMetadadosUrl(urlStr: string): Promise<MetadadosProduto> {
  if (!urlStr || !/^https?:\/\//i.test(urlStr)) {
    return { imagemUrl: "", tituloPagina: "", precoAtual: 0, precoAntigo: 0 };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(urlStr, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    clearTimeout(timer);

    if (!res.ok) return { imagemUrl: "", tituloPagina: "", precoAtual: 0, precoAntigo: 0 };
    const html = (await res.text()).slice(0, 180_000);

    // 1. Foto (og:image / twitter:image / landingImage / JSON-LD)
    const imgPatterns = [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<img[^>]+id=["']landingImage["'][^>]+src=["']([^"']+)["']/i,
      /"image"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
    ];

    let imagemUrl = "";
    for (const r of imgPatterns) {
      const m = html.match(r);
      if (m && m[1] && /^https?:\/\//i.test(m[1])) {
        imagemUrl = m[1].replace(/&amp;/g, "&");
        break;
      }
    }

    // 2. Titulo (og:title / <title>)
    const titlePatterns = [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ];

    let tituloPagina = "";
    for (const r of titlePatterns) {
      const m = html.match(r);
      if (m && m[1]) {
        tituloPagina = m[1]
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s*\|\s*Amazon.*$/i, "")
          .replace(/\s*\|\s*Mercado Livre.*$/i, "")
          .replace(/\s*\|\s*Shopee.*$/i, "")
          .trim();
        break;
      }
    }

    // 3. Preco atual (meta product:price:amount / JSON-LD / itemprop)
    const pricePatterns = [
      /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']product:price:amount["']/i,
      /<meta[^>]+itemprop=["']price["'][^>]+content=["']([^"']+)["']/i,
      /"(?:lowPrice|price)"\s*:\s*"?(\d+(?:[.,]\d{1,2})?)"?/i,
      /R\$\s*([\d.]+,\d{2})/i,
    ];

    let precoAtual = 0;
    for (const r of pricePatterns) {
      const m = html.match(r);
      if (m && m[1]) {
        const val = parseNumeroPreco(m[1]);
        if (val >= 5 && val <= 100_000) {
          precoAtual = val;
          break;
        }
      }
    }

    let precoAntigo = 0;
    const oldMatch = html.match(/"(?:highPrice|originalPrice|listPrice)"\s*:\s*"?(\d+(?:[.,]\d{1,2})?)"?/i);
    if (oldMatch && oldMatch[1]) {
      const val = parseNumeroPreco(oldMatch[1]);
      if (val > precoAtual && val <= 150_000) precoAntigo = val;
    }

    return { imagemUrl, tituloPagina, precoAtual, precoAntigo };
  } catch {
    return { imagemUrl: "", tituloPagina: "", precoAtual: 0, precoAntigo: 0 };
  }
}

export function registrarCupomAutomatico(
  codigo: string,
  loja: string,
  tituloOferta: string
) {
  const limpo = codigo.trim().toUpperCase();
  if (!limpo || limpo.length < 4) return;
  const db = getDbV3();

  const existe = db
    .prepare("SELECT id FROM cupons WHERE codigo = ? AND loja = ? LIMIT 1")
    .get(limpo, loja) as { id: string } | undefined;

  if (existe) {
    db.prepare("UPDATE cupons SET status = 'ativo', reportes_expirado = 0 WHERE id = ?").run(
      existe.id
    );
    return;
  }

  db.prepare(`
    INSERT INTO cupons (id, codigo, loja, descricao, valor_minimo, status, reportes_expirado, validade, criado_em)
    VALUES (?, ?, ?, ?, 0, 'ativo', 0, '', ?)
  `).run(
    gerarId("cup"),
    limpo,
    loja || "outra",
    tituloOferta.slice(0, 120),
    new Date().toISOString()
  );
}
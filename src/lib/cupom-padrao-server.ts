import fs from "node:fs";
import path from "node:path";
import { getDb, type Marca } from "@/lib/db";
import { converterLinkAfiliado } from "@/lib/afiliado";

export interface PadraoCupom {
  estilo: "oficial" | "dark" | "personalizado";
  titulo: string;
  subtitulo: string;
  chamada: string;
  mostrarLogoLoja: boolean;
  mostrarArroba: boolean;
  templateMensagem: string;
  fundoDataUrl: string;
  linksPorLoja: Record<string, string>;
}

const LINKS_BASE_LOJAS: Record<string, string> = {
  mercadolivre: "https://www.mercadolivre.com.br/cupons",
  shopee: "https://shopee.com.br/m/cupom-de-desconto",
  amazon: "https://www.amazon.com.br/gp/goldbox",
  aliexpress: "https://pt.aliexpress.com/",
  awin: "https://www.magazineluiza.com.br/",
  outra: "",
};

export const PADRAO_CUPOM_DEFAULT: PadraoCupom = {
  estilo: "oficial",
  titulo: "CUPOM NOVO",
  subtitulo: "Aplique no carrinho antes de acabar",
  chamada: "Teste agora no link da mensagem",
  mostrarLogoLoja: true,
  mostrarArroba: true,
  templateMensagem: [
    "🎟️ *CUPOM NOVO — {loja}*",
    "",
    "Código: *{codigo}*",
    "👉 Teste agora nesse link: {link}",
    "",
    "Via {arroba}",
  ].join("\n"),
  fundoDataUrl: "",
  linksPorLoja: {},
};

export function caminhoPadraoCupom(): string {
  const dir = path.join(process.cwd(), "dados");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "padrao-cupom.json");
}

export function lerPadraoCupom(): PadraoCupom {
  try {
    const p = caminhoPadraoCupom();
    if (!fs.existsSync(p)) return { ...PADRAO_CUPOM_DEFAULT };
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<PadraoCupom>;
    return {
      ...PADRAO_CUPOM_DEFAULT,
      ...raw,
      linksPorLoja: {
        ...PADRAO_CUPOM_DEFAULT.linksPorLoja,
        ...(raw.linksPorLoja || {}),
      },
    };
  } catch {
    return { ...PADRAO_CUPOM_DEFAULT };
  }
}

export function salvarPadraoCupom(proximo: PadraoCupom): void {
  fs.writeFileSync(caminhoPadraoCupom(), JSON.stringify(proximo, null, 2), "utf8");
}

export function resolverLinksLojasComAfiliado(padrao: PadraoCupom): Record<string, string> {
  const db = getDb();
  const marca = db
    .prepare("SELECT * FROM marcas WHERE ativa = 1 ORDER BY criado_em ASC LIMIT 1")
    .get() as unknown as Marca | undefined;

  const resultado: Record<string, string> = {};
  for (const [loja, urlBase] of Object.entries(LINKS_BASE_LOJAS)) {
    const custom = (padrao.linksPorLoja?.[loja] || "").trim();
    const alvo = custom || urlBase;
    if (!alvo) {
      resultado[loja] = "";
      continue;
    }
    if (marca) {
      resultado[loja] = converterLinkAfiliado(alvo, marca).urlAfiliado;
    } else {
      resultado[loja] = alvo;
    }
  }
  return resultado;
}

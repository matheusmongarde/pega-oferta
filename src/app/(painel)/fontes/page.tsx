"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Gaveta } from "@/components/ui/gaveta";
import {
  Check,
  Chrome,
  Download,
  ExternalLink,
  KeyRound,
  Plus,
  Radio,
  Rss,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  Users,
  Tag,
} from "lucide-react";

interface Fonte {
  id: string;
  nome: string;
  tipo: string;
  url: string;
  ativa: number;
  total_coletadas: number;
  ultima_coleta: string | null;
}

interface GrupoWa {
  jid: string;
  nome: string;
  participantes: number;
  espelhando: boolean;
  souAdmin?: boolean;
}

function IlustracaoRato() {
  return (
    <svg viewBox="0 0 96 96" className="h-20 w-20 shrink-0" fill="none" aria-hidden="true">
      <circle cx="28" cy="28" r="14" fill="#F06526" opacity="0.22" />
      <circle cx="28" cy="28" r="9" fill="#F06526" />
      <circle cx="68" cy="28" r="14" fill="#F06526" opacity="0.22" />
      <circle cx="68" cy="28" r="9" fill="#F06526" />
      <path d="M22 48C22 33 34 24 48 24C62 24 74 33 74 48C74 64 60 76 48 76C36 76 22 64 22 48Z" fill="#181B22" />
      <circle cx="38" cy="47" r="4.5" fill="#FFFFFF" />
      <circle cx="58" cy="47" r="4.5" fill="#FFFFFF" />
      <circle cx="39" cy="47" r="2" fill="#111318" />
      <circle cx="59" cy="47" r="2" fill="#111318" />
      <ellipse cx="48" cy="61" rx="6" ry="4.5" fill="#F06526" />
      <path d="M16 56L32 58M15 63L32 62M80 56L64 58M81 63L64 62" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IlustracaoGuerreiro() {
  return (
    <svg viewBox="0 0 96 96" className="h-20 w-20 shrink-0" fill="none" aria-hidden="true">
      <path d="M48 12L78 24V48C78 66 64 79 48 85C32 79 18 66 18 48V24L48 12Z" fill="#16A34A" opacity="0.16" stroke="#16A34A" strokeWidth="3.5" />
      <path d="M36 42C36 33 41 28 48 28C55 28 60 33 60 42V55L48 63L36 55V42Z" fill="#181B22" />
      <path d="M48 20V34" stroke="#16A34A" strokeWidth="4" strokeLinecap="round" />
      <path d="M39 45H57" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
      <path d="M48 45V56" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export default function FontesPage() {
  const [modoOperacao, setModoOperacao] = useState<"rataria" | "oficial">("rataria");
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [waEstado, setWaEstado] = useState<string>("desconectado");
  const [waNumero, setWaNumero] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoWa[]>([]);
  const [espelhados, setEspelhados] = useState<string[]>([]);
  const [buscaGrupo, setBuscaGrupo] = useState("");
  const [salvandoEspelho, setSalvandoEspelho] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Gavetas
  const [gavetaGrupos, setGavetaGrupos] = useState(false);
  const [gavetaAwin, setGavetaAwin] = useState(false);
  const [gavetaRss, setGavetaRss] = useState(false);
  const [gavetaExtensao, setGavetaExtensao] = useState(false);
  const [abaBiblioteca, setAbaBiblioteca] = useState<"gratuitas" | "apis" | "ferramentas">("gratuitas");
  const [ativandoLote, setAtivandoLote] = useState(false);

  // Config Awin direto na interface (zero .env!)
  const [awinPublisherId, setAwinPublisherId] = useState("");
  const [awinToken, setAwinToken] = useState("");
  const [awinConectada, setAwinConectada] = useState(false);
  const [salvandoAwin, setSalvandoAwin] = useState(false);

  // Novo feed RSS
  const [rssNome, setRssNome] = useState("");
  const [rssUrl, setRssUrl] = useState("");

  const FONTES_GRATUITAS_BR = [
    {
      sigla: "PB",
      cor: "#007AFF",
      nome: "Promobit · Ofertas do Dia",
      url: "https://www.promobit.com.br/",
      categoria: "Ofertas gerais",
      descricao: "Ofertas quentes do dia com foto, preço antigo, desconto % e loja (Amazon, ML, Shopee, Magalu).",
    },
    {
      sigla: "%",
      cor: "#B45309",
      nome: "Promobit · Central de Cupons",
      url: "https://www.promobit.com.br/cupons/",
      categoria: "Radar de Cupons",
      descricao: "Alimenta o Radar de Cupons com códigos ativos do dia prontos pra gerar arte com a logo oficial.",
    },
    {
      sigla: "PC",
      cor: "#1E293B",
      nome: "Promobit · Informática & Hardware",
      url: "https://www.promobit.com.br/promocoes/informatica/",
      categoria: "Tech & PC",
      descricao: "Placas de vídeo, SSDs, notebooks, monitores e periféricos com queda real de preço.",
    },
    {
      sigla: "GM",
      cor: "#4F46E5",
      nome: "Promobit · Games & Consoles",
      url: "https://www.promobit.com.br/promocoes/games/",
      categoria: "Games",
      descricao: "PS5, Xbox, Nintendo Switch, controles e jogos em promoção nas grandes varejistas.",
    },
    {
      sigla: "CT",
      cor: "#0F172A",
      nome: "Canaltech · Tech & Ofertas RSS",
      url: "https://canaltech.com.br/rss/",
      categoria: "RSS Oficial BR",
      descricao: "Feed oficial do Canaltech com lançamentos, celulares, comparativos e achados de tecnologia.",
    },
    {
      sigla: "AD",
      cor: "#DC2626",
      nome: "Adrenaline · Hardware & PC Gamer",
      url: "https://www.adrenaline.com.br/feed/",
      categoria: "RSS Oficial BR",
      descricao: "Feed oficial do Adrenaline focado em PC gamer, hardware, GPUs, monitores e periféricos.",
    },
    {
      sigla: "TC",
      cor: "#0284C7",
      nome: "TudoCelular · Smartphones RSS",
      url: "https://www.tudocelular.com/feed/",
      categoria: "RSS Oficial BR",
      descricao: "Feed oficial com alertas de preço, celulares custo-benefício e ofertas relâmpago.",
    },
    {
      sigla: "TB",
      cor: "#15803D",
      nome: "Tecnoblog · Tecnologia & Achados",
      url: "https://tecnoblog.net/feed/",
      categoria: "RSS Oficial BR",
      descricao: "Feed completo de tecnologia, streaming, celulares e guias de compra no Brasil.",
    },
    {
      sigla: "OD",
      cor: "#0369A1",
      nome: "Olhar Digital · Tech & Eletrônicos",
      url: "https://olhardigital.com.br/feed/",
      categoria: "RSS Oficial BR",
      descricao: "Feed atualizado com eletrônicos, smart home, celulares e novidades do mercado.",
    },
    {
      sigla: "MB",
      cor: "#334155",
      nome: "MeioBit · Gadgets & Cultura Tech",
      url: "https://meiobit.com/feed/",
      categoria: "RSS Oficial BR",
      descricao: "Feed brasileiro de gadgets, games, hardware e recomendações de produtos.",
    },
  ];

  const APIS_OFICIAIS = [
    {
      id: "awin",
      nome: "Awin Promotions API",
      logo: "/logos/magalu.png",
      lojas: "Magalu, KaBuM, Nike, Netshoes, Casas Bahia",
      status: awinConectada ? "Conectada" : "Configura aqui",
      conectada: awinConectada,
      endpoint: "https://api.awin.com/publisher/{publisherId}/promotions",
      docUrl: "https://wiki.awin.com/index.php/API_get_promotions",
      docLabel: "Documentação Awin API",
      descricao:
        "Puxa cupons e promoções oficiais direto da Awin com OAuth2 Bearer Token. Salva direto no painel sem editar .env.",
      acao: "awin" as const,
    },
    {
      id: "shopee",
      nome: "Shopee Affiliate Open API",
      logo: "/logos/shopee.svg",
      lojas: "Shopee Brasil (Ofertas + Comissões Extra)",
      status: "Documentação oficial",
      conectada: false,
      endpoint: "https://open-api.affiliate.shopee.com.br/graphql",
      docUrl: "https://affiliate.shopee.com.br/",
      docLabel: "Portal Shopee Open API",
      descricao:
        "GraphQL oficial (productOfferV2 e shopeeOfferV2) com AppID e Secret. Libere em Shopee Afiliados → Open API.",
      acao: "link" as const,
    },
    {
      id: "amazon",
      nome: "Amazon PA-API 5.0 (Associados)",
      logo: "/logos/amazon.svg",
      lojas: "Amazon Brasil (Preços, Ofertas e ASINs)",
      status: "Documentação oficial",
      conectada: false,
      endpoint: "https://webservices.amazon.com.br/paapi5/searchitems",
      docUrl: "https://webservices.amazon.com/paapi5/documentation/",
      docLabel: "Documentação PA-API 5.0",
      descricao:
        "API oficial da Amazon para buscar ofertas, preços em tempo real e imagens após completar 3 vendas qualificadas.",
      acao: "link" as const,
    },
    {
      id: "mercadolivre",
      nome: "Mercado Livre Afiliados & API",
      logo: "/logos/mercadolivre-oficial.png",
      lojas: "Mercado Livre Brasil (Busca & Catálogo)",
      status: "Documentação oficial",
      conectada: false,
      endpoint: "https://api.mercadolibre.com/sites/MLB/search",
      docUrl: "https://developers.mercadolivre.com.br/pt_br/api-docs-pt-br",
      docLabel: "Docs Mercado Livre Developers",
      descricao:
        "Consulte catálogo e ofertas do MLB combinando com sua tag matt_tool da Central de Afiliados do Mercado Livre.",
      acao: "link" as const,
    },
    {
      id: "lomadee",
      nome: "Lomadee / Rakuten Advertising",
      logo: "/logos/aliexpress.svg",
      lojas: "Centauro, Nike, Casas Bahia, AliExpress",
      status: "Documentação oficial",
      conectada: false,
      endpoint: "https://api.lomadee.com/v3/{appToken}/offer/_all",
      docUrl: "https://developer.lomadee.com/",
      docLabel: "Docs Lomadee API",
      descricao:
        "Redes de afiliados consolidadas no Brasil com endpoints oficiais de ofertas e cupons prontos para integração.",
      acao: "link" as const,
    },
  ];

  const carregar = useCallback(async () => {
    const [resF, resWa, resCfg] = await Promise.all([
      fetch("/api/fontes"),
      fetch("/api/whatsapp/baileys").catch(() => null),
      fetch("/api/config").catch(() => null),
    ]);
    const df = (await resF.json()) as { fontes: Fonte[] };
    setFontes(df.fontes || []);

    if (resWa && resWa.ok) {
      const dw = (await resWa.json()) as {
        estado?: string;
        numero?: string | null;
        grupos?: GrupoWa[];
        grupos_espelhados?: string[];
      };
      setWaEstado(dw.estado || "desconectado");
      setWaNumero(dw.numero || null);
      setGrupos(dw.grupos || []);
      setEspelhados(dw.grupos_espelhados || []);
    }

    if (resCfg && resCfg.ok) {
      const dc = (await resCfg.json()) as { config?: { awin_api_token?: string } };
      if (dc.config?.awin_api_token) {
        setAwinToken(dc.config.awin_api_token);
        setAwinConectada(true);
      }
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alternarGrupoEspelho(jid: string) {
    const proximo = espelhados.includes(jid)
      ? espelhados.filter((x) => x !== jid)
      : [...espelhados, jid];
    setEspelhados(proximo);
    setSalvandoEspelho(true);
    try {
      const res = await fetch("/api/whatsapp/baileys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "espelho", grupos: proximo }),
      });
      const d = (await res.json().catch(() => ({}))) as { importadas_historico?: number };
      setAviso(
        proximo.includes(jid)
          ? `Grupo espelhado ativado${
              d.importadas_historico ? ` (${d.importadas_historico} msg(s) recentes importadas)` : ""
            }!`
          : "Espelhamento removido do grupo."
      );
    } finally {
      setSalvandoEspelho(false);
    }
  }

  async function ativarFonteCatalogo(nome: string, url: string) {
    const jaExiste = fontes.some((f) => f.url.toLowerCase() === url.toLowerCase());
    if (!jaExiste) {
      await fetch("/api/fontes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, tipo: "rss", url, intervalo_min: 5 }),
      });
    }
    setAviso(`Fonte "${nome}" ativa! As ofertas dela chegam em Ofertas em até 20s.`);
    await carregar();
  }

  async function ativarTodasGratuitas() {
    setAtivandoLote(true);
    try {
      let adicionadas = 0;
      for (const item of FONTES_GRATUITAS_BR) {
        const jaExiste = fontes.some((f) => f.url.toLowerCase() === item.url.toLowerCase());
        if (!jaExiste) {
          await fetch("/api/fontes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome: item.nome, tipo: "rss", url: item.url, intervalo_min: 5 }),
          });
          adicionadas++;
        }
      }
      setAviso(
        adicionadas > 0
          ? `${adicionadas} fonte(s) gratuita(s) ativada(s)! As ofertas chegam em Ofertas em até 20s.`
          : "Todas as fontes gratuitas do catálogo já estão ativas."
      );
      await carregar();
    } finally {
      setAtivandoLote(false);
    }
  }

  async function salvarAwin(e: React.FormEvent) {
    e.preventDefault();
    if (!awinPublisherId.trim() || !awinToken.trim()) return;
    setSalvandoAwin(true);
    try {
      await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awin_api_token: awinToken.trim() }),
      });
      const url = `https://api.awin.com/publisher/${awinPublisherId.trim()}/promotions`;
      const jaExiste = fontes.some((f) => /api\.awin\.com\/publisher\//i.test(f.url));
      if (!jaExiste) {
        await fetch("/api/fontes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: "Awin · Promoções & Cupons Oficiais",
            tipo: "rss",
            url,
            intervalo_min: 15,
          }),
        });
      }
      setAwinConectada(true);
      setGavetaAwin(false);
      setAviso("Awin API conectada direto no painel — clique em Importar agora!");
      await carregar();
    } finally {
      setSalvandoAwin(false);
    }
  }

  async function adicionarRss(e: React.FormEvent) {
    e.preventDefault();
    if (!rssNome.trim() || !rssUrl.trim()) return;
    await fetch("/api/fontes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: rssNome.trim(), tipo: "rss", url: rssUrl.trim(), intervalo_min: 15 }),
    });
    setRssNome("");
    setRssUrl("");
    setGavetaRss(false);
    setAviso("Feed adicionado à biblioteca.");
    await carregar();
  }

  const gruposFiltrados = grupos.filter((g) =>
    g.nome.toLowerCase().includes(buscaGrupo.trim().toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        sobrelinha="PASSO 1 · CAPTAÇÃO AUTOMÁTICA"
        titulo="Fontes & Espelho."
        subtitulo="Escolha como quer abastecer seus grupos: espelhando grupos no WhatsApp (Modo Rataria) ou puxando direto de sites e APIs oficiais (Modo Oficial)."
        acoes={
          <a
            href="/ofertas"
            className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-acao px-4 text-sm font-semibold text-acao-texto transition hover:bg-acao-forte"
          >
            <Tag className="h-4 w-4" />
            <span>Ver ofertas</span>
          </a>
        }
      />

      {aviso && (
        <div className="flex items-center gap-2 rounded-[12px] border border-ok/30 bg-ok-suave px-4 py-3 text-sm font-medium text-ok">
          <Check className="h-4 w-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {/* GUIA VISUAL: COMO AS GRANDES OPERAÇÕES FAZEM (RATARIA vs OFICIAL) */}
      <section className="caixa p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-fogo">
              COMO AS GRANDES OPERAÇÕES FAZEM
            </p>
            <h2 className="mt-0.5 font-display text-lg font-extrabold text-tinta">
              Escolha seu estilo de captação (você pode usar os dois juntos)
            </h2>
          </div>
          <span className="selo selo-ok">Tudo entra ao vivo na Esteira</span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* MODO RATARIA */}
          <button
            type="button"
            onClick={() => setModoOperacao("rataria")}
            className={`group flex items-start gap-4 rounded-[18px] p-6 text-left transition ${
              modoOperacao === "rataria"
                ? "border-[3px] border-fogo bg-fogo/[0.06] shadow-[var(--sombra-card)]"
                : "border border-linha bg-fundo/55 hover:border-linha-forte"
            }`}
          >
            <IlustracaoRato />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-extrabold text-tinta">
                  Modo Rataria
                </span>
                <span className="rounded-full bg-fogo/15 px-2 py-0.5 text-[10px] font-bold uppercase text-fogo">
                  Espelho WhatsApp
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-tinta-2">
                Você espelha grandes grupos de ofertas que já participa. Caiu oferta lá, o robô
                <strong> arranca o link do concorrente</strong>, coloca a <strong>sua tag de afiliado</strong> e
                joga na sua Esteira em tempo real.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-tinta">
                <span>• {espelhados.length} grupo(s) espelhado(s)</span>
                <span>• Detecta cupons &amp; &ldquo;esgotou&rdquo;</span>
              </div>
            </div>
          </button>

          {/* MODO OFICIAL */}
          <button
            type="button"
            onClick={() => setModoOperacao("oficial")}
            className={`group flex items-start gap-4 rounded-[18px] p-6 text-left transition ${
              modoOperacao === "oficial"
                ? "border-[3px] border-fogo bg-fogo/[0.06] shadow-[var(--sombra-card)]"
                : "border border-linha bg-fundo/55 hover:border-linha-forte"
            }`}
          >
            <IlustracaoGuerreiro />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-extrabold text-tinta">
                  Modo Oficial
                </span>
                <span className="rounded-full bg-ok-suave px-2 py-0.5 text-[10px] font-bold uppercase text-ok">
                  APIs &amp; Sites
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-tinta-2">
                Captação limpa direto de <strong>portais de promoções</strong> e{" "}
                <strong>APIs oficiais de afiliados</strong> (Promobit, Awin, feeds RSS). Zero
                dependência de grupos de terceiros e escalável pra dezenas de nichos.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-tinta">
                <span>• {fontes.filter((f) => f.ativa === 1 && f.tipo === "rss").length} fonte(s) de site ativa(s)</span>
                <span>• Zero .env — configura aqui</span>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* PAINEL DE ESPELHAMENTO WHATSAPP (COMPACTO — GRUPOS RECOLHIDOS EM GAVETA) */}
      <section className="caixa p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="grid h-11 w-11 place-items-center rounded-[12px] bg-[#25D366]/15 text-[#15803d]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-tinta">
                  Espelhamento de Grupos do WhatsApp
                </h3>
                <span className={`selo ${waEstado === "conectado" ? "selo-ok" : "selo-alerta"}`}>
                  {waEstado === "conectado" ? `Conectado (${waNumero || "ativo"})` : "Desconectado"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-tinta-3">
                {espelhados.length > 0
                  ? `${espelhados.length} grupo(s) sendo monitorados em tempo real de ${grupos.length} disponíveis.`
                  : "Clique ao lado para escolher quais grupos copiar — os grupos ficam recolhidos pra manter a tela leve."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {waEstado !== "conectado" ? (
              <Link
                href="/conexoes"
                className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-acao px-4 text-xs font-semibold text-acao-texto hover:bg-acao-forte"
              >
                <Radio className="h-4 w-4" />
                <span>Conectar WhatsApp</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setGavetaGrupos(true)}
                className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-acao px-4 text-xs font-semibold text-acao-texto hover:bg-acao-forte"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Selecionar grupos ({espelhados.length}/{grupos.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Chips apenas dos grupos ja espelhados */}
        {espelhados.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-linha pt-3.5">
            {espelhados.map((jid) => {
              const g = grupos.find((x) => x.jid === jid);
              return (
                <span
                  key={jid}
                  className="inline-flex items-center gap-2 rounded-full border border-ok/30 bg-ok-suave px-3 py-1 text-xs font-semibold text-ok"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                  <span>{g?.nome || jid}</span>
                  <button
                    type="button"
                    onClick={() => alternarGrupoEspelho(jid)}
                    className="ml-1 text-ok/70 hover:text-erro"
                    title="Parar de espelhar"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </section>

      {/* BIBLIOTECA DE FONTES (SEM .ENV — GRATUITAS BR + APIS OFICIAIS COM DOCS) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-extrabold text-tinta">
              Biblioteca de Fontes &amp; APIs
            </h2>
            <p className="text-xs text-tinta-3">
              {FONTES_GRATUITAS_BR.length} fontes gratuitas testadas do Brasil + {APIS_OFICIAIS.length} APIs oficiais de afiliados com documentação.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {abaBiblioteca === "gratuitas" && (
              <button
                type="button"
                disabled={ativandoLote}
                onClick={ativarTodasGratuitas}
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-acao px-3.5 text-xs font-semibold text-acao-texto hover:bg-acao-forte disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{ativandoLote ? "Ativando..." : "Ativar todas gratuitas"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setGavetaRss(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-linha-forte bg-superficie px-3.5 text-xs font-semibold text-tinta hover:bg-rebaixo"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Adicionar RSS / URL</span>
            </button>
          </div>
        </div>

        {/* Abas da biblioteca */}
        <div className="flex flex-wrap gap-2 border-b border-linha pb-3">
          <button
            type="button"
            onClick={() => setAbaBiblioteca("gratuitas")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              abaBiblioteca === "gratuitas"
                ? "bg-acao text-acao-texto"
                : "border border-linha bg-superficie text-tinta-2 hover:text-tinta"
            }`}
          >
            Gratuitas BR ({FONTES_GRATUITAS_BR.length})
          </button>
          <button
            type="button"
            onClick={() => setAbaBiblioteca("apis")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              abaBiblioteca === "apis"
                ? "bg-acao text-acao-texto"
                : "border border-linha bg-superficie text-tinta-2 hover:text-tinta"
            }`}
          >
            APIs Oficiais com Docs ({APIS_OFICIAIS.length})
          </button>
          <button
            type="button"
            onClick={() => setAbaBiblioteca("ferramentas")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              abaBiblioteca === "ferramentas"
                ? "bg-acao text-acao-texto"
                : "border border-linha bg-superficie text-tinta-2 hover:text-tinta"
            }`}
          >
            Extensão, Monitor &amp; RSS ({fontes.filter((f) => f.tipo === "rss").length} ativos)
          </button>
        </div>

        {/* ABA 1: FONTES GRATUITAS BR */}
        {abaBiblioteca === "gratuitas" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FONTES_GRATUITAS_BR.map((item) => {
              const ativa = fontes.some((f) => f.url.toLowerCase() === item.url.toLowerCase());
              return (
                <article key={item.url} className="caixa flex flex-col justify-between p-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex min-w-0 items-center gap-2 font-display text-sm font-extrabold text-tinta">
                        <span
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-xs font-black text-white"
                          style={{ backgroundColor: item.cor }}
                        >
                          {item.sigla}
                        </span>
                        <span className="truncate">{item.nome}</span>
                      </span>
                      <span className={`selo shrink-0 ${ativa ? "selo-ok" : ""}`}>
                        {ativa ? "Ativa ✓" : "Grátis"}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-tinta-2">{item.descricao}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-linha pt-3">
                    <span className="text-[11px] font-medium text-tinta-3">{item.categoria}</span>
                    <button
                      type="button"
                      onClick={() => ativarFonteCatalogo(item.nome, item.url)}
                      className={`text-xs font-semibold hover:underline ${
                        ativa ? "text-ok" : "text-fogo"
                      }`}
                    >
                      {ativa ? "Sincronizando" : "Ativar em 1 clique"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ABA 2: APIS OFICIAIS DE AFILIADOS COM DOCUMENTAÇÃO */}
        {abaBiblioteca === "apis" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {APIS_OFICIAIS.map((api) => (
              <article key={api.id} className="caixa flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-2 font-display text-sm font-extrabold text-tinta">
                      <img
                        src={api.logo}
                        alt={api.nome}
                        className="h-6 w-auto max-w-[84px] rounded-[5px] object-contain"
                      />
                      <span className="truncate">{api.nome}</span>
                    </span>
                    <span className={`selo shrink-0 ${api.conectada ? "selo-ok" : "selo-alerta"}`}>
                      {api.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-tinta-3">{api.lojas}</p>
                  <p className="mt-2 text-xs leading-relaxed text-tinta-2">{api.descricao}</p>
                  <div className="mt-3 rounded-[8px] border border-linha bg-fundo px-2.5 py-1.5 font-mono text-[10px] text-tinta-3 break-all">
                    {api.endpoint}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-linha pt-3">
                  <a
                    href={api.docUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-tinta-2 hover:text-tinta"
                  >
                    <span>{api.docLabel}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {api.acao === "awin" ? (
                    <button
                      type="button"
                      onClick={() => setGavetaAwin(true)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-fogo hover:underline"
                    >
                      <KeyRound className="h-3 w-3" />
                      <span>{api.conectada ? "Editar chave" : "Conectar chave"}</span>
                    </button>
                  ) : (
                    <Link
                      href="/marcas"
                      className="text-xs font-semibold text-fogo hover:underline"
                    >
                      Configurar tag
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {/* ABA 3: EXTENSÃO CHROME, MONITOR E RSS CUSTOM */}
        {abaBiblioteca === "ferramentas" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Extensao Chrome */}
            <article className="caixa flex flex-col justify-between p-5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 font-display text-sm font-extrabold text-tinta">
                    <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[#181B22] text-white">
                      <Chrome className="h-4 w-4" />
                    </span>
                    <span>Extensão Chrome</span>
                  </span>
                  <span className="selo">1 clique</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-tinta-2">
                  Achou um achado navegando na Amazon, ML ou Shopee? Clica no ícone da extensão e já cai na Esteira com foto e sua tag.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-linha pt-3">
                <button
                  type="button"
                  onClick={() => setGavetaExtensao(true)}
                  className="text-xs font-medium text-tinta-2 hover:text-tinta"
                >
                  Como instalar
                </button>
                <a
                  href="/api/extensao/download"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-fogo hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Baixar .zip</span>
                </a>
              </div>
            </article>

            {/* Monitor de Preco */}
            <article className="caixa flex flex-col justify-between p-5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 font-display text-sm font-extrabold text-tinta">
                    <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-ok-suave text-ok">
                      <TrendingDown className="h-4 w-4" />
                    </span>
                    <span>Monitor de Preço</span>
                  </span>
                  <span className="selo">Automático</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-tinta-2">
                  Cadastre produtos campeões + preço-alvo. Quando o preço cair na loja, o robô cria a oferta sozinho e avisa você.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-linha pt-3">
                <span className="text-[11px] text-tinta-3">Vigia 24h</span>
                <Link href="/monitor" className="inline-flex items-center gap-1 text-xs font-semibold text-fogo hover:underline">
                  <span>Abrir Monitor</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </article>

            {/* Feeds RSS extras cadastrados */}
            <article className="caixa flex flex-col justify-between p-5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 font-display text-sm font-extrabold text-tinta">
                    <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-rebaixo text-tinta">
                      <Rss className="h-4 w-4" />
                    </span>
                    <span>Feeds RSS Custom</span>
                  </span>
                  <span className="selo">{fontes.filter((f) => f.tipo === "rss").length} ativos</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-tinta-2">
                  Adicione qualquer blog de achados, portal de hardware ou feed XML. O coletor lê automaticamente no ciclo do Piloto.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-linha pt-3">
                <span className="text-[11px] text-tinta-3">XML / Atom / JSON</span>
                <button
                  type="button"
                  onClick={() => setGavetaRss(true)}
                  className="text-xs font-semibold text-fogo hover:underline"
                >
                  + Adicionar feed
                </button>
              </div>
            </article>
          </div>
        )}
      </section>

      {/* GAVETA: SELECIONAR GRUPOS DO WHATSAPP (BUSCA + CONTADOR) */}
      <Gaveta
        aberta={gavetaGrupos}
        onFechar={() => setGavetaGrupos(false)}
        titulo="Selecionar grupos para espelhar"
        subtitulo={`WhatsApp conectado (${waNumero || "ativo"}) · Marque os grupos fonte para copiar ofertas e cupons em tempo real.`}
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-3" />
            <input
              value={buscaGrupo}
              onChange={(e) => setBuscaGrupo(e.target.value)}
              placeholder={`Buscar entre ${grupos.length} grupos...`}
              className="campo !pl-9 text-xs"
            />
          </div>

          <div className="space-y-1.5 pb-4">
            {gruposFiltrados.map((g) => {
              const ativo = espelhados.includes(g.jid);
              return (
                <div
                  key={g.jid}
                  className={`flex items-center justify-between gap-2 rounded-[10px] border p-3 transition ${
                    ativo ? "border-ok/40 bg-ok-suave/50" : "border-linha bg-fundo/50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-tinta">{g.nome}</p>
                    <p className="text-[11px] text-tinta-3">
                      {g.participantes} membros {g.souAdmin ? "· Você é Admin" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={salvandoEspelho}
                    onClick={() => alternarGrupoEspelho(g.jid)}
                    className={`shrink-0 rounded-[8px] px-3 py-1.5 text-xs font-semibold transition ${
                      ativo
                        ? "bg-ok text-white"
                        : "border border-linha-forte bg-superficie text-tinta hover:border-fogo hover:text-fogo"
                    }`}
                  >
                    {ativo ? "Espelhando ✓" : "Espelhar"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </Gaveta>

      {/* GAVETA: CONECTAR AWIN API DIRETO NO PAINEL */}
      <Gaveta
        aberta={gavetaAwin}
        onFechar={() => setGavetaAwin(false)}
        titulo="Conectar Awin API Oficial"
        subtitulo="Salva seu Publisher ID e Token direto no banco local — sem precisar editar .env."
      >
        <form onSubmit={salvarAwin} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-tinta-2">
              Awin Publisher ID
            </label>
            <input
              required
              value={awinPublisherId}
              onChange={(e) => setAwinPublisherId(e.target.value)}
              placeholder="Ex: 1459201"
              className="campo font-mono"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-tinta-2">
              Awin OAuth2 API Token
            </label>
            <input
              required
              type="password"
              value={awinToken}
              onChange={(e) => setAwinToken(e.target.value)}
              placeholder="Cole seu token do painel Awin"
              className="campo font-mono"
            />
            <p className="mt-1 text-[11px] text-tinta-3">
              Pegue em <strong>ui.awin.com → API Credentials</strong>. Fica salvo só no seu computador.
            </p>
          </div>
          <button
            type="submit"
            disabled={salvandoAwin}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-acao text-sm font-semibold text-acao-texto hover:bg-acao-forte disabled:opacity-50"
          >
            <Shield className="h-4 w-4" />
            <span>{salvandoAwin ? "Salvando..." : "Salvar e ativar Awin"}</span>
          </button>
        </form>
      </Gaveta>

      {/* GAVETA: ADICIONAR FEED RSS */}
      <Gaveta
        aberta={gavetaRss}
        onFechar={() => setGavetaRss(false)}
        titulo="Adicionar fonte RSS ou Site"
        subtitulo="Cole a URL do feed XML/Atom para importar automaticamente."
      >
        <form onSubmit={adicionarRss} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-tinta-2">Nome da fonte</label>
            <input
              required
              value={rssNome}
              onChange={(e) => setRssNome(e.target.value)}
              placeholder="Ex: Adrenaline Hardware"
              className="campo"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-tinta-2">URL do feed</label>
            <input
              required
              type="url"
              value={rssUrl}
              onChange={(e) => setRssUrl(e.target.value)}
              placeholder="https://..."
              className="campo font-mono text-xs"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-acao text-sm font-semibold text-acao-texto hover:bg-acao-forte"
          >
            <Sparkles className="h-4 w-4" />
            <span>Salvar fonte</span>
          </button>
        </form>
      </Gaveta>

      {/* GAVETA: COMO INSTALAR EXTENSÃO CHROME */}
      <Gaveta
        aberta={gavetaExtensao}
        onFechar={() => setGavetaExtensao(false)}
        titulo="Instalar Extensão no Chrome"
        subtitulo="3 passos rápidos (menos de 30 segundos)."
      >
        <ol className="space-y-3 text-xs leading-relaxed text-tinta-2">
          <li className="rounded-[10px] border border-linha bg-fundo p-3">
            <strong>1. Baixe e extraia o .zip</strong> clicando no botão <em>Baixar .zip</em>.
          </li>
          <li className="rounded-[10px] border border-linha bg-fundo p-3">
            <strong>2. Abra <code>chrome://extensions</code></strong> e ative o <strong>Modo do desenvolvedor</strong> no canto superior direito.
          </li>
          <li className="rounded-[10px] border border-linha bg-fundo p-3">
            <strong>3. Clique em &ldquo;Carregar sem compactação&rdquo;</strong> e selecione a pasta extraída. Pronto!
          </li>
        </ol>
      </Gaveta>
    </div>
  );
}

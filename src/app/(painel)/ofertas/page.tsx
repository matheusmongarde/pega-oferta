"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Gaveta } from "@/components/ui/gaveta";
import { GeradorCardModal } from "@/components/gerador-card";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Flame,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";

interface Oferta {
  id: string;
  titulo: string;
  loja: string;
  preco: number;
  preco_antigo: number | null;
  desconto_pct: number | null;
  cupom: string;
  url_original: string;
  url_afiliado: string;
  imagem_url: string;
  status: "nova" | "aprovada" | "enviada" | "descartada";
  cliques: number;
  exemplo: number;
  origem_label?: string;
  criado_em?: string;
}

interface PreviewParse {
  titulo: string;
  loja: string;
  preco: number;
  preco_antigo: number | null;
  desconto_pct: number | null;
  cupom: string;
  url_afiliado: string;
  imagem_url: string;
  convertido: boolean;
  preview_mensagem: string;
}

const LOJAS: Record<string, string> = {
  amazon: "Amazon",
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
  aliexpress: "AliExpress",
  awin: "Awin",
  outra: "Loja",
};

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function OfertasPage() {
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [statusFiltro, setStatusFiltro] = useState("todas");
  const [periodoFiltro, setPeriodoFiltro] = useState<"hoje" | "anteriores" | "todas">("todas");
  const [nichoFiltro, setNichoFiltro] = useState("todos");
  const [pagina, setPagina] = useState(1);
  const [lojaFiltro, setLojaFiltro] = useState("todas");
  const [busca, setBusca] = useState("");
  const [gavetaAberta, setGavetaAberta] = useState(false);

  const [textoCola, setTextoCola] = useState("");
  const [preview, setPreview] = useState<PreviewParse | null>(null);
  const [duplicadaAviso, setDuplicadaAviso] = useState(false);
  const [carregandoParse, setCarregandoParse] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [disparandoId, setDisparandoId] = useState<string | null>(null);
  const [ofertaCard, setOfertaCard] = useState<Oferta | null>(null);
  const [identidade, setIdentidade] = useState({ arroba: "@pegaoferta", logo: "" });
  const [contagem, setContagem] = useState<Record<string, number>>({});
  const [sincronizando, setSincronizando] = useState(false);

  const carregar = useCallback(async () => {
    const qs = new URLSearchParams();
    if (statusFiltro !== "todas") qs.set("status", statusFiltro);
    if (lojaFiltro !== "todas") qs.set("loja", lojaFiltro);
    if (busca.trim()) qs.set("q", busca.trim());
    const res = await fetch(`/api/ofertas?${qs.toString()}`);
    const data = (await res.json()) as { ofertas: Oferta[]; contagem?: Record<string, number> };
    setOfertas(data.ofertas || []);
    if (data.contagem) setContagem(data.contagem);
  }, [statusFiltro, lojaFiltro, busca]);

  useEffect(() => {
    carregar();
    const id = window.setInterval(() => {
      carregar().catch(() => {});
    }, 15000);
    fetch("/api/config")
      .then((r) => r.json())
      .then((d: { config?: { arroba_marca?: string; logo_data_url?: string } }) => {
        if (d.config) {
          setIdentidade({
            arroba: d.config.arroba_marca || "@pegaoferta",
            logo: d.config.logo_data_url || "",
          });
        }
      })
      .catch(() => {});
    return () => window.clearInterval(id);
  }, [carregar]);

  async function testarConversao() {
    if (!textoCola.trim()) return;
    setCarregandoParse(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/parser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoCola }),
      });
      const data = (await res.json()) as {
        parseada?: PreviewParse;
        duplicada?: boolean;
        erro?: string;
      };
      if (data.parseada) {
        setPreview(data.parseada);
        setDuplicadaAviso(Boolean(data.duplicada));
      } else if (data.erro) {
        setFeedback(data.erro);
      }
    } finally {
      setCarregandoParse(false);
    }
  }

  async function salvarOferta(forcar = false) {
    if (!textoCola.trim()) return;
    setCarregandoParse(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/ofertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoCola, aprovar: true, forcar_duplicada: forcar }),
      });
      const data = (await res.json()) as { erro?: string; duplicada?: boolean };
      if (res.status === 409 && data.duplicada) {
        setDuplicadaAviso(true);
        setFeedback("Oferta repetida bloqueada pela deduplicacao.");
        return;
      }
      if (!res.ok) {
        setFeedback(data.erro || "Erro ao salvar oferta.");
        return;
      }
      setTextoCola("");
      setPreview(null);
      setDuplicadaAviso(false);
      setGavetaAberta(false);
      setFeedback("Oferta salva com foto, tag aplicada e cupom registrado no Radar.");
      await carregar();
    } finally {
      setCarregandoParse(false);
    }
  }

  async function disparar(id: string) {
    setDisparandoId(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/ofertas/${id}/disparar`, { method: "POST" });
      const data = (await res.json()) as { detalhe?: string; status?: string };
      setFeedback(data.detalhe || `Status: ${data.status}`);
      await carregar();
    } finally {
      setDisparandoId(null);
    }
  }

  async function excluir(id: string) {
    await fetch(`/api/ofertas/${id}`, { method: "DELETE" });
    await carregar();
  }

  async function sincronizarAgora() {
    setSincronizando(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/fontes/coletar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = (await res.json().catch(() => ({}))) as {
        novas?: number;
        duplicadas?: number;
        resultados?: Array<{ novas: number; duplicadas?: number }>;
      };
      const novas = d.novas ?? (d.resultados || []).reduce((s, r) => s + (r.novas || 0), 0);
      const repetidas = d.duplicadas ?? (d.resultados || []).reduce((s, r) => s + (r.duplicadas || 0), 0);
      setFeedback(
        (d.resultados || []).length === 0
          ? "Nenhuma fonte ativa. Ative as fontes gratuitas em Fontes & Espelho."
          : novas > 0
            ? `Sincronizado: ${novas} oferta(s) nova(s)${repetidas ? `, ${repetidas} repetida(s) barrada(s)` : ""}.`
            : "Tudo em dia: nenhuma oferta nova desde a última sincronização."
      );
      await carregar();
    } finally {
      setSincronizando(false);
    }
  }

  async function limparExemplos() {
    await fetch("/api/ofertas?exemplos=1", { method: "DELETE" });
    setFeedback("Ofertas de exemplo removidas.");
    await carregar();
  }

  const temExemplos = ofertas.some((o) => o.exemplo === 1);

  return (
    <div>
      <PageHeader
        sobrelinha="CATALOGO · FOTO E TAG AUTOMATICAS"
        titulo="Ofertas."
        subtitulo="Cada oferta mostra de onde veio. Apenas ofertas enviadas aparecem na sua Vitrine Publica. Cada card ja puxa foto do link, injeta sua tag, registra o cupom no Radar e gera Story 9:16."
        acoes={
          <>
            {temExemplos && (
              <button
                type="button"
                onClick={limparExemplos}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-linha-forte bg-superficie px-3.5 text-xs font-semibold text-tinta-2 hover:text-erro"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Limpar exemplos</span>
              </button>
            )}
            <button
              type="button"
              disabled={sincronizando}
              onClick={sincronizarAgora}
              title="Puxa agora as ofertas de todas as fontes ativas (o automático roda a cada 20s)"
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-linha-forte bg-superficie px-4 text-sm font-semibold text-tinta transition hover:border-tinta-3 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${sincronizando ? "animate-spin" : ""}`} />
              <span>{sincronizando ? "Sincronizando..." : "Sincronizar agora"}</span>
            </button>
            <button
              type="button"
              onClick={() => setGavetaAberta(true)}
              className="glow-fogo inline-flex h-10 items-center gap-2 rounded-[10px] bg-acao px-4 text-sm font-semibold text-acao-texto transition hover:bg-acao-forte"
            >
              <Plus className="h-4 w-4" />
              <span>Colar oferta</span>
            </button>
          </>
        }
      />

      {feedback && (
        <div className="mb-5 rounded-[12px] border border-linha bg-superficie px-4 py-3 text-sm font-medium text-tinta shadow-[var(--sombra)]">
          {feedback}
        </div>
      )}

      <div className="caixa mb-6 flex flex-wrap items-center justify-between gap-3 p-3.5">
        <div className="flex flex-wrap items-center gap-3">
          {/* Grupo 1: Período */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-tinta-3">
              Período:
            </span>
            <div className="inline-flex rounded-[10px] bg-rebaixo/70 p-0.5">
              {(
                [
                  { id: "hoje", label: "Hoje" },
                  { id: "anteriores", label: "Anteriores" },
                  { id: "todas", label: "Todas" },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPeriodoFiltro(p.id);
                    setPagina(1);
                  }}
                  className={`h-8 rounded-[8px] px-3 text-xs font-semibold transition ${
                    periodoFiltro === p.id
                      ? "bg-superficie text-tinta shadow-xs"
                      : "text-tinta-2 hover:text-tinta"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grupo 2: Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-tinta-3">
              Status:
            </span>
            <div className="inline-flex flex-wrap rounded-[10px] bg-rebaixo/70 p-0.5">
              {["todas", "nova", "aprovada", "enviada", "expiradas"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFiltro(st);
                    setPagina(1);
                  }}
                  className={`h-8 rounded-[8px] px-2.5 text-xs font-semibold capitalize transition ${
                    statusFiltro === st
                      ? "bg-fogo text-white shadow-xs"
                      : "text-tinta-2 hover:text-tinta"
                  }`}
                >
                  {st}
                  {contagem[st] !== undefined && (
                    <span className="num ml-1 opacity-70">{contagem[st]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={nichoFiltro}
            onChange={(e) => {
              setNichoFiltro(e.target.value);
              setPagina(1);
            }}
            aria-label="Filtrar por nicho"
            className="campo !min-h-[36px] !h-9 !w-auto !py-1 text-xs"
          >
            <option value="todos">Todos os nichos</option>
            <option value="tech">Tech &amp; Eletrônicos</option>
            <option value="casa">Casa &amp; Cozinha</option>
            <option value="moda">Moda &amp; Esporte</option>
            <option value="games">Games &amp; PC</option>
            <option value="mercado">Mercado &amp; Saúde</option>
          </select>

          <select
            value={lojaFiltro}
            onChange={(e) => setLojaFiltro(e.target.value)}
            aria-label="Filtrar por loja"
            className="campo !min-h-[36px] !h-9 !w-auto !py-1 text-xs"
          >
            <option value="todas">Todas as lojas</option>
            <option value="amazon">Amazon</option>
            <option value="mercadolivre">Mercado Livre</option>
            <option value="shopee">Shopee</option>
            <option value="aliexpress">AliExpress</option>
            <option value="awin">Awin</option>
          </select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tinta-3" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto ou cupom..."
              className="campo !min-h-[36px] !h-9 !w-52 !py-1 !pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {(() => {
        const hojeStr = new Date().toLocaleDateString("pt-BR");
        const RE_NICHO: Record<string, RegExp> = {
          tech: /(ssd|fone|iphone|samsung|celular|notebook|tv|monitor|carregador|alexa|kindle|tablet|smartwatch|jbl)/i,
          casa: /(air\s*fryer|fritadeira|cafeteira|aspirador|panela|ventilador|geladeira|micro|casa|cozinha|cama)/i,
          moda: /(t[eê]nis|nike|adidas|fila|camiseta|jaqueta|mochila|rel[oó]gio|perfume|esporte)/i,
          games: /(ps5|playstation|xbox|nintendo|switch|rtx|teclado|mouse|headset|gamer|controle|cadeira)/i,
          mercado: /(whey|creatina|caf[eé]|fralda|sab[aã]o|shampoo|mercado|cerveja|chocolate|suplemento)/i,
        };
        const ofertasVisiveis = ofertas.filter((o) => {
          if (periodoFiltro !== "todas") {
            const ehHoje = o.criado_em
              ? new Date(o.criado_em).toLocaleDateString("pt-BR") === hojeStr
              : true;
            if (periodoFiltro === "hoje" && !ehHoje) return false;
            if (periodoFiltro === "anteriores" && ehHoje) return false;
          }
          if (nichoFiltro !== "todos" && RE_NICHO[nichoFiltro]) {
            if (!RE_NICHO[nichoFiltro].test(o.titulo)) return false;
          }
          return true;
        });

        const POR_PAGINA = 12;
        const totalPaginas = Math.max(1, Math.ceil(ofertasVisiveis.length / POR_PAGINA));
        const pagAtual = Math.min(pagina, totalPaginas);
        const fatiadas = ofertasVisiveis.slice((pagAtual - 1) * POR_PAGINA, pagAtual * POR_PAGINA);

        if (ofertasVisiveis.length === 0) {
          return (
            <div className="caixa hachura p-12 text-center">
              <Flame className="mx-auto h-8 w-8 text-fogo" />
              <p className="mt-3 text-[15px] font-semibold text-tinta">Nenhuma oferta neste filtro.</p>
              <p className="mt-1 text-sm text-tinta-3">
                Alterne entre Hoje / Todas ou clique em &ldquo;Sincronizar agora&rdquo; aqui em cima.
              </p>
            </div>
          );
        }

        return (
          <>
          <p className="mb-3 text-xs font-semibold text-tinta-3">
            <span className="num text-tinta">{ofertasVisiveis.length}</span>{" "}
            {ofertasVisiveis.length === 1 ? "oferta" : "ofertas"} neste filtro
          </p>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {fatiadas.map((o) => (
            <article key={o.id} className="caixa caixa-viva flex flex-col overflow-hidden">
              <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-linha bg-rebaixo">
                {o.imagem_url ? (
                  <img src={o.imagem_url} alt={o.titulo} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-tinta-3">
                    <Flame className="h-8 w-8 opacity-40" />
                  </div>
                )}

                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-black/75 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                    {LOJAS[o.loja] || o.loja}
                  </span>
                  {o.desconto_pct && (
                    <span className="rounded-full bg-fogo px-2.5 py-0.5 font-mono text-[11px] font-bold text-white">
                      -{o.desconto_pct}%
                    </span>
                  )}
                </div>

                <span className="absolute right-3 top-3 rounded-full bg-superficie/90 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-tinta backdrop-blur-sm">
                  {o.cliques} cliques
                </span>
              </div>

              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate font-medium text-tinta-3">
                      {o.origem_label || (o.exemplo === 1 ? "Exemplo" : "Catalogo")}
                    </span>
                    <span className="truncate font-mono text-[10px] text-tinta-3">
                      {(() => {
                        try {
                          return new URL(o.url_afiliado || o.url_original).hostname.replace(/^www\./, "");
                        } catch {
                          return o.loja;
                        }
                      })()}
                    </span>
                  </div>
                  <h3 className="line-clamp-2 min-h-[44px] text-[15px] font-semibold leading-snug text-tinta">
                    {o.titulo}
                  </h3>

                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <div>
                      {o.preco_antigo && (
                        <span className="block font-mono text-xs text-tinta-3 line-through">
                          {brl(o.preco_antigo)}
                        </span>
                      )}
                      <span className="font-display text-2xl font-bold text-tinta">
                        {o.preco > 0 ? brl(o.preco) : "Ver loja"}
                      </span>
                    </div>

                    {o.cupom && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(o.cupom)}
                        className="inline-flex items-center gap-1 rounded-[8px] border border-dashed border-linha-forte bg-rebaixo px-2.5 py-1 font-mono text-xs font-semibold text-tinta hover:border-fogo"
                        title="Copiar cupom"
                      >
                        <span>{o.cupom}</span>
                        <Copy className="h-3 w-3 text-tinta-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-linha pt-3.5">
                  <button
                    type="button"
                    onClick={() => disparar(o.id)}
                    disabled={disparandoId === o.id}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[9px] bg-acao px-3 text-xs font-semibold text-acao-texto transition hover:bg-acao-forte disabled:opacity-60"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{disparandoId === o.id ? "Enviando..." : "Disparar"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOfertaCard(o)}
                    className="inline-flex h-9 items-center gap-1 rounded-[9px] border border-linha-forte px-2.5 text-xs font-semibold text-tinta hover:border-fogo"
                    title="Gerar Card 9:16"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-fogo" />
                    <span>Story</span>
                  </button>

                  <a
                    href={`/ir/${o.id}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Abrir link"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-linha-forte text-tinta-3 hover:text-tinta"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => excluir(o.id)}
                    aria-label="Excluir"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-linha-forte text-tinta-3 hover:border-erro hover:text-erro"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
            ))}
          </div>
          {totalPaginas > 1 && (
            <div className="mt-6 flex items-center justify-between rounded-[12px] border border-linha bg-superficie px-4 py-3 text-xs">
              <span className="text-tinta-3">
                Mostrando <strong className="text-tinta">{fatiadas.length}</strong> de{" "}
                <strong className="text-tinta">{ofertasVisiveis.length}</strong> ofertas · Página{" "}
                <strong className="text-tinta">{pagAtual}/{totalPaginas}</strong>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={pagAtual <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  className="rounded-[8px] border border-linha px-3 py-1.5 font-semibold text-tinta disabled:opacity-40 hover:bg-fundo"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={pagAtual >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  className="rounded-[8px] border border-linha px-3 py-1.5 font-semibold text-tinta disabled:opacity-40 hover:bg-fundo"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
          </>
        );
      })()}

      <Gaveta
        aberta={gavetaAberta}
        aoFechar={() => setGavetaAberta(false)}
        sobrelinha="PARSER INTELIGENTE"
        titulo="Colar oferta ou link"
        subtitulo="Desencurta o link, puxa a foto automaticamente, aplica sua tag e salva o cupom no Radar."
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-tinta-3">
              Texto ou link da promocao
            </label>
            <textarea
              rows={5}
              value={textoCola}
              onChange={(e) => setTextoCola(e.target.value)}
              placeholder="Cole aqui qualquer mensagem de grupo ou link da Amazon, Mercado Livre, Shopee ou AliExpress..."
              className="campo resize-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={testarConversao}
              disabled={carregandoParse || !textoCola.trim()}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-linha-forte bg-superficie px-3 text-xs font-semibold text-tinta hover:border-fogo disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-fogo" />
              <span>Testar e puxar foto</span>
            </button>
            <button
              type="button"
              onClick={() => salvarOferta(false)}
              disabled={carregandoParse || !textoCola.trim()}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-acao px-4 text-xs font-semibold text-acao-texto hover:bg-acao-forte disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Salvar oferta</span>
            </button>
          </div>

          {duplicadaAviso && (
            <button
              type="button"
              onClick={() => salvarOferta(true)}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] bg-alerta-suave px-4 text-xs font-semibold text-alerta"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Repetida detectada — salvar mesmo assim</span>
            </button>
          )}

          {preview && (
            <div className="rounded-[14px] border border-linha bg-rebaixo/60 p-4">
              {preview.imagem_url && (
                <img
                  src={preview.imagem_url}
                  alt={preview.titulo}
                  className="mb-3 aspect-[16/10] w-full rounded-[10px] border border-linha object-cover"
                />
              )}
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-tinta">
                {preview.preview_mensagem}
              </pre>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="selo selo-info">{LOJAS[preview.loja] || preview.loja}</span>
                <span className={`selo ${preview.convertido ? "selo-ok" : "selo-alerta"}`}>
                  {preview.convertido ? "Tag aplicada" : "Sem tag nesta loja"}
                </span>
                {preview.imagem_url && <span className="selo selo-ok">Foto capturada</span>}
              </div>
            </div>
          )}
        </div>
      </Gaveta>

      {ofertaCard && (
        <GeradorCardModal
          oferta={ofertaCard}
          arrobaInicial={identidade.arroba}
          logoInicial={identidade.logo}
          onClose={() => setOfertaCard(null)}
        />
      )}
    </div>
  );
}
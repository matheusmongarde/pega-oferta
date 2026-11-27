"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Gaveta } from "@/components/ui/gaveta";
import {
  Check,
  Chrome,
  Copy,
  Crosshair,
  ExternalLink,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
} from "lucide-react";

interface MonitorPreco {
  id: string;
  titulo: string;
  url: string;
  loja: string;
  imagem_url: string;
  preco_atual: number;
  preco_alvo: number;
  menor_preco: number;
  ativo: number;
  status: "monitorando" | "alvo_atingido" | "erro";
  ultimo_check: string;
}

const LOJAS: Record<string, string> = {
  amazon: "Amazon",
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
  aliexpress: "AliExpress",
  awin: "Awin",
  outra: "Loja",
};

function fmt(v: number) {
  if (!v || v <= 0) return "--";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function MonitorPage() {
  const [monitores, setMonitores] = useState<MonitorPreco[]>([]);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [checagemGlobal, setChecagemGlobal] = useState(false);
  const [checandoId, setChecandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiadoBook, setCopiadoBook] = useState(false);

  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [precoAlvo, setPrecoAlvo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const res = await fetch("/api/monitor");
    const data = (await res.json()) as { monitores: MonitorPreco[] };
    setMonitores(data.monitores || []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || !precoAlvo) return;
    setSalvando(true);
    setAviso(null);
    try {
      const res = await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          titulo: titulo.trim(),
          preco_alvo: Number(precoAlvo.replace(",", ".")),
        }),
      });
      if (res.ok) {
        setUrl("");
        setTitulo("");
        setPrecoAlvo("");
        setGavetaAberta(false);
        setAviso("Produto adicionado ao Radar de Preco.");
        await carregar();
      } else {
        const d = (await res.json().catch(() => ({}))) as { erro?: string };
        setAviso(d.erro || "Erro ao adicionar monitor.");
      }
    } finally {
      setSalvando(false);
    }
  }

  async function checar(id?: string) {
    if (id) setChecandoId(id);
    else setChecagemGlobal(true);
    setAviso(null);
    try {
      const res = await fetch("/api/monitor/checar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
      const data = (await res.json()) as { checados?: number; resultado?: { alvo_atingido?: boolean } };
      if (id) {
        setAviso(
          data.resultado?.alvo_atingido
            ? "Alvo atingido! Oferta criada automaticamente no catalogo."
            : "Preco verificado e historico atualizado."
        );
      } else {
        setAviso(`${data.checados ?? 0} monitores verificados agora.`);
      }
      await carregar();
    } finally {
      setChecandoId(null);
      setChecagemGlobal(false);
    }
  }

  async function remover(id: string) {
    await fetch(`/api/monitor?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await carregar();
  }

  function copiarBookmarklet() {
    const code = "javascript:(function(){const t=document.title;const u=location.href;fetch('http://localhost:3000/api/v1/ofertas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texto:t+'\n'+u,disparar:false})}).then(r=>r.ok?alert('Enviado pro pega-oferta!'):alert('Erro ao enviar')).catch(()=>alert('Ligue o pega-oferta em localhost:3000'));})();";
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiadoBook(true);
    setTimeout(() => setCopiadoBook(false), 2500);
  }

  const atingidos = monitores.filter((m) => m.status === "alvo_atingido").length;

  return (
    <div>
      <PageHeader
        sobrelinha="CAPTAÇÃO · CAÇA-BUG"
        titulo="Monitor de Preço"
        subtitulo="Vigia links de lojas automaticamente. Quando bate seu preço-alvo, cria a oferta com foto e sua tag na hora."
        acoes={
          <>
            <button
              type="button"
              onClick={() => checar()}
              disabled={checagemGlobal}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-linha-forte bg-superficie px-4 text-sm font-semibold text-tinta transition hover:border-fogo disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${checagemGlobal ? "animate-spin" : ""}`} />
              <span>{checagemGlobal ? "Verificando..." : "Checar todos"}</span>
            </button>
            <button
              type="button"
              onClick={() => setGavetaAberta(true)}
              className="glow-fogo inline-flex h-10 items-center gap-2 rounded-[10px] bg-fogo px-4 text-sm font-semibold text-white transition hover:bg-fogo-2"
            >
              <Plus className="h-4 w-4" />
              <span>Monitorar produto</span>
            </button>
          </>
        }
      />

      {aviso && (
        <div className="mb-5 flex items-center gap-2 rounded-[12px] border border-ok/30 bg-ok-fundo px-4 py-3 text-sm font-medium text-ok">
          <Check className="h-4 w-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="cartao p-5 lg:col-span-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-tinta-3">
            Produtos vigiados
          </div>
          <div className="num mt-2 text-3xl font-extrabold text-tinta">{monitores.length}</div>
          <div className="mt-1 text-xs text-tinta-3">Checados no Piloto Automático</div>
        </div>
        <div className="cartao p-5 lg:col-span-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-tinta-3">
            Alvo atingido
          </div>
          <div className="num mt-2 text-3xl font-extrabold text-fogo">{atingidos}</div>
          <div className="mt-1 text-xs text-tinta-3">Prontos para disparar nos grupos</div>
        </div>
        <div className="cartao hachura flex flex-col justify-between gap-3 p-5 lg:col-span-6 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fogo">
              <Chrome className="h-3.5 w-3.5" />
              <span>Extensão Chrome + Bookmarklet (1 clique)</span>
            </div>
            <p className="mt-1 text-sm text-tinta-2">
              Carregue a pasta <code className="rounded bg-rebaixo px-1.5 py-0.5 font-mono text-xs">extensao-chrome/</code> em{" "}
              <code className="rounded bg-rebaixo px-1.5 py-0.5 font-mono text-xs">chrome://extensions</code> para capturar ofertas direto da loja.
            </p>
          </div>
          <button
            type="button"
            onClick={copiarBookmarklet}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] border border-linha-forte bg-superficie px-3 text-xs font-semibold text-tinta transition hover:border-fogo"
          >
            {copiadoBook ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiadoBook ? "Copiado!" : "Copiar Bookmarklet"}</span>
          </button>
        </div>
      </div>

      {monitores.length === 0 && (
        <div className="caixa hachura p-12 text-center">
          <Crosshair className="mx-auto h-8 w-8 text-fogo" />
          <p className="mt-3 text-[15px] font-semibold text-tinta">Nenhum produto vigiado ainda</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-tinta-3">
            Cole o link de um produto e o preço que você quer pagar. Quando bater, a oferta entra pronta com foto e sua tag.
          </p>
          <button
            type="button"
            onClick={() => setGavetaAberta(true)}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-[10px] bg-acao px-4 text-sm font-semibold text-acao-texto hover:bg-acao-forte"
          >
            <Plus className="h-4 w-4" />
            <span>Monitorar o primeiro produto</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {monitores.map((m) => {
          const atingiu = m.status === "alvo_atingido";
          const diferenca = m.preco_atual > 0 && m.preco_alvo > 0 ? m.preco_atual - m.preco_alvo : 0;
          const pctProgresso =
            m.preco_atual > 0 && m.preco_alvo > 0
              ? Math.min(100, Math.max(12, Math.round((m.preco_alvo / m.preco_atual) * 100)))
              : 20;

          return (
            <article
              key={m.id}
              className="cartao group flex flex-col overflow-hidden transition hover:border-fogo/50"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-rebaixo">
                {m.imagem_url ? (
                  <img
                    src={m.imagem_url}
                    alt={m.titulo}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-tinta-3">
                    <Crosshair className="h-8 w-8 opacity-40" />
                  </div>
                )}
                <div className="absolute left-3 top-3">
                  <span className="rounded-md bg-black/70 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                    {LOJAS[m.loja] || m.loja}
                  </span>
                </div>
                <div className="absolute right-3 top-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      atingiu
                        ? "bg-fogo text-white shadow-md"
                        : "bg-superficie/95 text-tinta-2"
                    }`}
                  >
                    {atingiu ? "Alvo atingido" : "Vigiando"}
                  </span>
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <h3 className="line-clamp-2 font-display text-base font-bold leading-snug text-tinta">
                    {m.titulo}
                  </h3>

                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-[12px] bg-rebaixo/60 p-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-tinta-3">
                        Preço atual
                      </div>
                      <div className={`num mt-0.5 text-lg font-extrabold ${atingiu ? "text-ok" : "text-tinta"}`}>
                        {fmt(m.preco_atual)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-tinta-3">
                        Seu alvo
                      </div>
                      <div className="num mt-0.5 text-lg font-extrabold text-fogo">{fmt(m.preco_alvo)}</div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-tinta-3">
                      <span className="inline-flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        Menor visto: <strong className="num text-tinta-2">{fmt(m.menor_preco)}</strong>
                      </span>
                      <span className="num">
                        {atingiu
                          ? "Bateu!"
                          : diferenca > 0
                          ? `Faltam ${fmt(diferenca)}`
                          : "Aguardando"}
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-rebaixo">
                      <div
                        className={`h-full rounded-full transition-all ${atingiu ? "bg-ok" : "bg-fogo"}`}
                        style={{ width: `${atingiu ? 100 : pctProgresso}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-linha pt-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => checar(m.id)}
                      disabled={checandoId === m.id}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-linha-forte bg-superficie px-2.5 text-xs font-semibold text-tinta transition hover:border-fogo disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${checandoId === m.id ? "animate-spin" : ""}`} />
                      <span>Checar</span>
                    </button>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-linha bg-superficie text-tinta-2 transition hover:text-tinta"
                      title="Abrir na loja"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => remover(m.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-tinta-3 transition hover:bg-erro-fundo hover:text-erro"
                    title="Remover monitor"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Gaveta
        aberta={gavetaAberta}
        aoFechar={() => setGavetaAberta(false)}
        sobrelinha="CACA-BUG AUTOMATICO"
        titulo="Adicionar produto ao Monitor"
      >
        <form onSubmit={adicionar} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-tinta-2">
              Link do produto na loja *
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.amazon.com.br/dp/..."
              className="w-full rounded-[10px] border border-linha-forte bg-superficie px-3 py-2.5 text-sm text-tinta outline-none focus:border-fogo"
            />
            <p className="mt-1 text-xs text-tinta-3">
              Puxamos foto, titulo e preco atual automaticamente.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-tinta-2">
              Preco-alvo para disparar alerta (R$) *
            </label>
            <input
              type="text"
              required
              value={precoAlvo}
              onChange={(e) => setPrecoAlvo(e.target.value)}
              placeholder="Ex: 249,90"
              className="num w-full rounded-[10px] border border-linha-forte bg-superficie px-3 py-2.5 text-sm text-tinta outline-none focus:border-fogo"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-tinta-2">
              Apelido / Titulo (opcional)
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Deixe vazio para puxar da loja"
              className="w-full rounded-[10px] border border-linha-forte bg-superficie px-3 py-2.5 text-sm text-tinta outline-none focus:border-fogo"
            />
          </div>

          <button
            type="submit"
            disabled={salvando}
            className="glow-fogo inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-fogo px-4 text-sm font-semibold text-white transition hover:bg-fogo-2 disabled:opacity-50"
          >
            <Crosshair className="h-4 w-4" />
            <span>{salvando ? "Lendo loja e salvando..." : "Comecar a vigiar"}</span>
          </button>
        </form>
      </Gaveta>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Gaveta } from "@/components/ui/gaveta";
import {
  ArrowRight,
  Bot,
  Check,
  Clock,
  ExternalLink,
  GripVertical,
  Play,
  Save,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";

interface ConfigOperacao {
  modo_teste: boolean;
  limite_diario: number;
  intervalo_segundos: number;
  janela_dedup_horas: number;
  expirar_ofertas_horas: number;
  horario_inicio: string;
  horario_fim: string;
}

interface ConfigAutomacao {
  ativo: boolean;
  intervalo_minutos: number;
  disparar_aprovadas: boolean;
  coletar_rss: boolean;
  checar_monitores: boolean;
}

interface OfertaEsteira {
  id: string;
  titulo: string;
  loja: string;
  preco: number;
  desconto_pct: number | null;
  cupom: string;
  imagem_url: string;
  url_afiliado?: string;
  origem_label?: string;
  status: "nova" | "aprovada" | "enviada" | "descartada";
  cliques: number;
}

type ColunaId = "nova" | "aprovada" | "enviada";

function fmt(v: number) {
  if (!v || v <= 0) return "--";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FilaPage() {
  const [config, setConfig] = useState<ConfigOperacao | null>(null);
  const [autoCfg, setAutoCfg] = useState<ConfigAutomacao | null>(null);
  const [ofertas, setOfertas] = useState<OfertaEsteira[]>([]);
  const [enviosHoje, setEnviosHoje] = useState(0);
  const [gruposWa, setGruposWa] = useState<
    Array<{
      jid: string;
      nome: string;
      participantes: number;
      souAdmin?: boolean;
      instancia?: string;
      instancia_nome?: string;
    }>
  >([]);
  const [instanciasWa, setInstanciasWa] = useState<
    Array<{ id: string; nome: string; estado: string; numero: string | null }>
  >([]);
  const [instanciaAtiva, setInstanciaAtiva] = useState<string>("principal");
  const [destinosSelecionados, setDestinosSelecionados] = useState<string[]>([]);
  const [waConectado, setWaConectado] = useState(false);
  const [gavetaDestinos, setGavetaDestinos] = useState(false);
  const [buscaDestino, setBuscaDestino] = useState("");

  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [rodandoCiclo, setRodandoCiclo] = useState(false);
  const [acaoId, setAcaoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Estado de Drag & Drop
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [colunaHover, setColunaHover] = useState<ColunaId | null>(null);

  const carregar = useCallback(async () => {
    const [resFila, resAuto, resOfertas, resWa] = await Promise.all([
      fetch("/api/fila"),
      fetch("/api/automacao"),
      fetch("/api/ofertas"),
      fetch("/api/whatsapp/baileys").catch(() => null),
    ]);
    const dataFila = (await resFila.json()) as { envios_hoje: number; config: ConfigOperacao };
    const dataAuto = (await resAuto.json()) as { config: ConfigAutomacao };
    const dataOfertas = (await resOfertas.json()) as { ofertas: OfertaEsteira[] };
    setEnviosHoje(dataFila.envios_hoje || 0);
    setConfig(dataFila.config);
    setAutoCfg(dataAuto.config);
    setOfertas(dataOfertas.ofertas || []);
    if (resWa && resWa.ok) {
      const w = (await resWa.json()) as {
        estado?: string;
        instancias?: Array<{ id: string; nome: string; estado: string; numero: string | null }>;
        grupos?: Array<{
          jid: string;
          nome: string;
          participantes: number;
          souAdmin?: boolean;
          instancia?: string;
          instancia_nome?: string;
        }>;
      };
      const conectadas = (w.instancias || []).filter((i) => i.estado === "conectado");
      setInstanciasWa(conectadas);
      setWaConectado(w.estado === "conectado" || conectadas.length > 0);
      if (conectadas.length > 0 && !conectadas.some((i) => i.id === instanciaAtiva)) {
        setInstanciaAtiva(conectadas[0].id);
      }
      const ordenados = [...(w.grupos || [])].sort(
        (a, b) => Number(Boolean(b.souAdmin)) - Number(Boolean(a.souAdmin))
      );
      setGruposWa(ordenados);
    }
  }, []);

  useEffect(() => {
    carregar();
    const id = window.setInterval(() => {
      carregar().catch(() => {});
    }, 15000);
    return () => window.clearInterval(id);
  }, [carregar]);

  async function moverPara(id: string, destino: ColunaId) {
    const atual = ofertas.find((o) => o.id === id);
    if (!atual || atual.status === destino) return;

    setAcaoId(id);
    setAviso(null);
    // Atualizacao otimista
    setOfertas((prev) => prev.map((o) => (o.id === id ? { ...o, status: destino } : o)));

    try {
      if (destino === "enviada") {
        const payload =
          destinosSelecionados.length > 0
            ? { destinos: destinosSelecionados, instancia: instanciaAtiva }
            : {};
        const res = await fetch(`/api/ofertas/${id}/disparar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const d = (await res.json().catch(() => ({}))) as { ok?: boolean; erro?: string; detalhe?: string };
        setAviso(
          d.ok
            ? destinosSelecionados.length === 1
              ? `Oferta disparada no grupo "${gruposWa.find((g) => g.jid === destinosSelecionados[0])?.nome || "selecionado"}" e publicada na Vitrine!`
              : destinosSelecionados.length > 1
              ? `Oferta disparada em ${destinosSelecionados.length} grupos selecionados e publicada na Vitrine!`
              : "Oferta disparada nas conexões cadastradas e publicada na Vitrine!"
            : d.erro || d.detalhe || "Disparo bloqueado pelas travas anti-ban."
        );
      } else {
        await fetch(`/api/ofertas/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: destino }),
        });
        setAviso(
          destino === "aprovada"
            ? "Oferta movida para a Fila de Disparo."
            : "Oferta devolvida para Captadas."
        );
      }
      await carregar();
    } finally {
      setAcaoId(null);
    }
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setArrastandoId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOverColuna(e: React.DragEvent, col: ColunaId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (colunaHover !== col) setColunaHover(col);
  }

  async function onDropColuna(e: React.DragEvent, col: ColunaId) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || arrastandoId;
    setArrastandoId(null);
    setColunaHover(null);
    if (id) await moverPara(id, col);
  }

  async function alternarPiloto() {
    if (!autoCfg) return;
    const novo = !autoCfg.ativo;
    await fetch("/api/automacao", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: novo }),
    });
    setAviso(novo ? "Piloto Automatico ligado." : "Piloto Automatico pausado.");
    await carregar();
  }

  async function rodarCicloAgora() {
    setRodandoCiclo(true);
    setAviso(null);
    try {
      const res = await fetch("/api/automacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forcar: true }),
      });
      const data = (await res.json()) as { detalhe?: string };
      setAviso(`Ciclo concluido: ${data.detalhe || "ok"}`);
      await carregar();
    } finally {
      setRodandoCiclo(false);
    }
  }

  async function salvarConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!config || !autoCfg) return;
    setSalvando(true);
    try {
      await Promise.all([
        fetch("/api/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        }),
        fetch("/api/automacao", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(autoCfg),
        }),
      ]);
      setGavetaAberta(false);
      setAviso("Regras da esteira e anti-ban salvas.");
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  function alternarDestino(jid: string) {
    setDestinosSelecionados((prev) =>
      prev.includes(jid) ? prev.filter((x) => x !== jid) : [...prev, jid]
    );
  }

  const labelDestinoBotao =
    destinosSelecionados.length === 0
      ? "Disparar nos canais"
      : destinosSelecionados.length === 1
      ? `Disparar em "${gruposWa.find((g) => g.jid === destinosSelecionados[0])?.nome || "grupo"}"`
      : `Disparar em ${destinosSelecionados.length} grupos`;

  const gruposFiltradosDestino = gruposWa.filter((g) =>
    g.nome.toLowerCase().includes(buscaDestino.trim().toLowerCase())
  );
  const atalhosGrupos = gruposWa.filter((g) => g.souAdmin).slice(0, 6);
  const pillsDestinos = atalhosGrupos.length > 0 ? atalhosGrupos : gruposWa.slice(0, 5);

  const colunas: Array<{
    id: ColunaId;
    etapa: string;
    titulo: string;
    corBadge: string;
    vazio: string;
    itens: OfertaEsteira[];
  }> = [
    {
      id: "nova",
      etapa: "ETAPA 1",
      titulo: "Captadas",
      corBadge: "bg-rebaixo text-tinta",
      vazio: "Arraste aqui ou ative um grupo em Fontes & Espelho.",
      itens: ofertas.filter((o) => o.status === "nova"),
    },
    {
      id: "aprovada",
      etapa: "ETAPA 2",
      titulo: "Na Fila",
      corBadge: "bg-fogo-suave text-fogo",
      vazio: "Arraste uma oferta captada para ca para preparar o disparo.",
      itens: ofertas.filter((o) => o.status === "aprovada"),
    },
    {
      id: "enviada",
      etapa: "ETAPA 3",
      titulo: "Disparadas & Vitrine",
      corBadge: "bg-ok-suave text-ok",
      vazio: "Arraste da Fila para ca para disparar e publicar na Vitrine.",
      itens: ofertas.filter((o) => o.status === "enviada"),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        sobrelinha="PASSO 3 · ESTEIRA KANBAN"
        titulo="Esteira & Fila."
        subtitulo="Arraste os cards de uma coluna para outra (ou use o botao de 1 clique) para aprovar e disparar."
        acoes={
          <>
            <button
              type="button"
              onClick={rodarCicloAgora}
              disabled={rodandoCiclo}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-linha-forte bg-superficie px-4 text-sm font-semibold text-tinta transition hover:bg-rebaixo disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              <span>{rodandoCiclo ? "Rodando..." : "Rodar ciclo agora"}</span>
            </button>
            <button
              type="button"
              onClick={() => setGavetaAberta(true)}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-acao px-4 text-sm font-semibold text-acao-texto transition hover:bg-acao-forte"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Configurar travas</span>
            </button>
          </>
        }
      />

      {aviso && (
        <div className="flex items-center gap-2 rounded-[12px] border border-ok/30 bg-ok-suave px-4 py-3 text-sm font-medium text-ok">
          <Check className="h-4 w-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {/* Barra limpa de status operacional */}
      <div className="caixa flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Bot className={`h-4 w-4 ${autoCfg?.ativo ? "text-ok" : "text-tinta-3"}`} />
            <span className="font-semibold text-tinta">
              Piloto: {autoCfg?.ativo ? "Ligado" : "Pausado"}
            </span>
            <button
              type="button"
              onClick={alternarPiloto}
              className={`rounded-full px-2.5 py-0.5 font-semibold transition ${
                autoCfg?.ativo
                  ? "bg-ok-suave text-ok"
                  : "bg-rebaixo text-tinta-2 hover:text-tinta"
              }`}
            >
              {autoCfg?.ativo ? "Pausar" : "Ligar"}
            </button>
          </div>
          <span className="hidden text-linha-forte sm:inline">|</span>
          <div className="flex items-center gap-1.5 text-tinta-2">
            <Clock className="h-4 w-4 text-tinta-3" />
            <span>
              Busca a cada <strong className="num text-tinta">{autoCfg?.intervalo_minutos ?? 5} min</strong>
            </span>
          </div>
          <span className="hidden text-linha-forte sm:inline">|</span>
          <div className="flex items-center gap-1.5 text-tinta-2">
            <ShieldCheck className="h-4 w-4 text-fogo" />
            <span>{config?.modo_teste ? "Modo Simulação" : "Modo Produção"}</span>
          </div>
          <span className="hidden text-linha-forte sm:inline">|</span>
          <div className="num text-tinta-2">
            Envios hoje: <strong className="text-tinta">{enviosHoje}/{config?.limite_diario ?? 40}</strong>
          </div>
          <span className="hidden text-linha-forte sm:inline">|</span>
          <div className="num text-tinta-2">
            Janela: <strong className="text-tinta">{config?.horario_inicio ?? "08:00"}–{config?.horario_fim ?? "23:00"}</strong>
          </div>
        </div>
        <span className="text-[11px] text-tinta-3">Dica: segure e arraste qualquer card entre as colunas</span>
      </div>

      {/* SELETOR DE DESTINO DO DISPARO (MULTI-GRUPOS WHATSAPP OU CANAIS) */}
      <div className="caixa flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-tinta">
            <Send className="h-3.5 w-3.5 text-fogo" />
            <span>Para onde vai o disparo:</span>
          </span>
          <button
            type="button"
            onClick={() => setDestinosSelecionados([])}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              destinosSelecionados.length === 0
                ? "bg-acao text-acao-texto"
                : "border border-linha bg-fundo text-tinta-2 hover:text-tinta"
            }`}
          >
            Conexões padrão (Telegram / Webhook)
          </button>
          {pillsDestinos.map((g) => {
            const ativo = destinosSelecionados.includes(g.jid);
            return (
              <button
                key={g.jid}
                type="button"
                onClick={() => alternarDestino(g.jid)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  ativo
                    ? "bg-ok text-white"
                    : "border border-linha bg-fundo text-tinta-2 hover:border-linha-forte hover:text-tinta"
                }`}
              >
                {ativo ? "✓ " : ""}
                {g.nome} {g.souAdmin ? "★" : ""}
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {instanciasWa.length > 0 && (
            <select
              value={instanciaAtiva}
              onChange={(e) => setInstanciaAtiva(e.target.value)}
              title="Qual WhatsApp envia neste grupo"
              className="h-8 rounded-[8px] border border-linha-forte bg-superficie px-2.5 text-xs font-semibold text-tinta"
            >
              {instanciasWa.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  WA: {inst.nome} {inst.numero ? `(${inst.numero.slice(-4)})` : ""}
                </option>
              ))}
            </select>
          )}
          <Link
            href="/marcas#modelo-mensagem"
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-linha-forte bg-superficie px-3 text-xs font-semibold text-tinta hover:bg-rebaixo"
          >
            <span>Editar texto do disparo</span>
          </Link>
          {waConectado ? (
            <button
              type="button"
              onClick={() => setGavetaDestinos(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-linha-forte bg-superficie px-3 text-xs font-semibold text-tinta hover:bg-rebaixo"
            >
              <Users className="h-3.5 w-3.5" />
              <span>
                Escolher grupos ({destinosSelecionados.length}/{gruposWa.length})
              </span>
            </button>
          ) : (
            <Link
              href="/conexoes"
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-linha-forte bg-superficie px-3 text-xs font-semibold text-fogo hover:bg-rebaixo"
            >
              <span>Conectar WhatsApp</span>
            </Link>
          )}
        </div>
      </div>

      {/* KANBAN DRAG & DROP */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {colunas.map((col) => {
          const destacando = colunaHover === col.id;
          return (
            <section
              key={col.id}
              onDragOver={(e) => onDragOverColuna(e, col.id)}
              onDragLeave={() => setColunaHover(null)}
              onDrop={(e) => onDropColuna(e, col.id)}
              className={`caixa flex min-h-[420px] flex-col overflow-hidden transition ${
                destacando ? "border-fogo ring-2 ring-fogo/25" : ""
              }`}
            >
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{
                  backgroundColor:
                    col.id === "nova"
                      ? "var(--sec-ofertas-bg)"
                      : col.id === "aprovada"
                      ? "var(--sec-esteira-bg)"
                      : "var(--sec-grupos-bg)",
                  color:
                    col.id === "nova"
                      ? "var(--sec-ofertas-fg)"
                      : col.id === "aprovada"
                      ? "var(--sec-esteira-fg)"
                      : "var(--sec-grupos-fg)",
                }}
              >
                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-wider opacity-80">
                    {col.etapa}
                  </span>
                  <h2 className="font-display text-base font-extrabold">{col.titulo}</h2>
                </div>
                <span className="num display text-2xl font-extrabold leading-none">
                  {col.itens.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-3.5">
                {col.itens.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center rounded-[14px] bg-fundo/70 p-8 text-center">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-superficie text-tinta-3 shadow-xs">
                      <Send className="h-5 w-5 opacity-60" />
                    </div>
                    <p className="mt-3 text-sm font-bold text-tinta">
                      {col.id === "enviada"
                        ? "Nada disparado ainda hoje"
                        : col.id === "aprovada"
                        ? "Fila limpa por enquanto"
                        : "Nenhuma oferta nova aqui"}
                    </p>
                    <p className="mt-1 max-w-[22ch] text-xs text-tinta-3">
                      {col.vazio}
                    </p>
                  </div>
                ) : (
                  col.itens.slice(0, 18).map((o) => (
                    <article
                      key={o.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, o.id)}
                      onDragEnd={() => {
                        setArrastandoId(null);
                        setColunaHover(null);
                      }}
                      className={`group cursor-grab rounded-[13px] border border-linha bg-superficie p-3.5 shadow-[0_1px_2px_rgba(24,22,20,0.03)] transition hover:shadow-[var(--sombra)] active:cursor-grabbing ${
                        arrastandoId === o.id ? "opacity-45" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <GripVertical className="mt-1 h-4 w-4 shrink-0 text-tinta-3/60 group-hover:text-tinta-2" />
                        {o.imagem_url ? (
                          <img
                            src={o.imagem_url}
                            alt={o.titulo}
                            className="h-16 w-16 shrink-0 rounded-[10px] border border-linha bg-fundo object-cover"
                          />
                        ) : (
                          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[10px] bg-rebaixo px-1 text-center text-[10px] font-bold text-tinta-2">
                            {o.loja}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-tinta-3">
                              {o.origem_label || o.loja}
                            </span>
                            {o.desconto_pct && o.desconto_pct > 0 ? (
                              <span className="num rounded bg-ok-suave px-1.5 py-0.5 text-[10px] font-bold text-ok">
                                -{o.desconto_pct}%
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug text-tinta">
                            {o.titulo}
                          </p>
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="num text-xs font-bold text-tinta">{fmt(o.preco)}</span>
                            {o.cupom && (
                              <span className="rounded bg-fogo-suave px-1.5 py-0.5 font-mono text-[10px] font-bold text-fogo">
                                {o.cupom}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-linha pt-2.5">
                        {col.id === "nova" && (
                          <button
                            type="button"
                            disabled={acaoId === o.id}
                            onClick={() => moverPara(o.id, "aprovada")}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-[8px] border border-linha-forte bg-fundo py-1.5 text-xs font-semibold text-tinta transition hover:border-fogo hover:text-fogo disabled:opacity-50"
                          >
                            <span>Enviar para Fila</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {col.id === "aprovada" && (
                          <button
                            type="button"
                            disabled={acaoId === o.id}
                            onClick={() => moverPara(o.id, "enviada")}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-[8px] bg-acao px-2 py-1.5 text-xs font-semibold text-acao-texto transition hover:bg-acao-forte disabled:opacity-50"
                          >
                            <Send className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {acaoId === o.id ? "Disparando..." : labelDestinoBotao}
                            </span>
                          </button>
                        )}
                        {col.id === "enviada" && (
                          <div className="flex w-full items-center justify-between text-[11px] text-tinta-3">
                            <span className="num font-semibold text-tinta-2">{o.cliques} cliques</span>
                            <Link
                              href="/vitrine"
                              target="_blank"
                              className="inline-flex items-center gap-1 font-semibold text-fogo hover:underline"
                            >
                              <span>Vitrine</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* GAVETA DE CONFIGURACAO */}
      <Gaveta
        aberta={gavetaAberta}
        onFechar={() => setGavetaAberta(false)}
        titulo="Travas anti-ban e Piloto Automatico"
        subtitulo="Ajuste ritmo de disparo, horario permitido e modo simulacao."
      >
        {config && autoCfg && (
          <form onSubmit={salvarConfig} className="space-y-4">
            <label className="flex cursor-pointer items-center justify-between rounded-[11px] border border-linha bg-fundo/50 p-3.5">
              <div>
                <p className="text-sm font-semibold text-tinta">Modo Simulacao</p>
                <p className="text-xs text-tinta-3">Grava historico sem enviar de verdade nos grupos.</p>
              </div>
              <input
                type="checkbox"
                checked={config.modo_teste}
                onChange={(e) => setConfig({ ...config, modo_teste: e.target.checked })}
                className="h-4 w-4 accent-fogo"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-tinta-2">Limite diario</label>
                <input
                  type="number"
                  value={config.limite_diario}
                  onChange={(e) => setConfig({ ...config, limite_diario: Number(e.target.value) })}
                  className="campo"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-tinta-2">Intervalo (seg)</label>
                <input
                  type="number"
                  value={config.intervalo_segundos}
                  onChange={(e) =>
                    setConfig({ ...config, intervalo_segundos: Number(e.target.value) })
                  }
                  className="campo"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-tinta-2">Inicio</label>
                <input
                  type="time"
                  value={config.horario_inicio}
                  onChange={(e) => setConfig({ ...config, horario_inicio: e.target.value })}
                  className="campo"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-tinta-2">Fim</label>
                <input
                  type="time"
                  value={config.horario_fim}
                  onChange={(e) => setConfig({ ...config, horario_fim: e.target.value })}
                  className="campo"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-tinta-2">
                Expirar ofertas não enviadas após
              </label>
              <select
                value={config.expirar_ofertas_horas ?? 24}
                onChange={(e) =>
                  setConfig({ ...config, expirar_ofertas_horas: Number(e.target.value) })
                }
                className="campo"
              >
                <option value={6}>6 horas (super leve)</option>
                <option value={12}>12 horas</option>
                <option value={24}>24 horas (padrão recomendado)</option>
                <option value={48}>48 horas</option>
                <option value={72}>72 horas</option>
                <option value={0}>Nunca expirar</option>
              </select>
              <p className="mt-1 text-[11px] text-tinta-3">
                Ofertas antigas não enviadas somem da fila automaticamente para o sistema ficar sempre leve.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-tinta-2">
                Frequência de busca automática das fontes
              </label>
              <select
                value={autoCfg.intervalo_minutos ?? 5}
                onChange={(e) =>
                  setAutoCfg({ ...autoCfg, intervalo_minutos: Number(e.target.value) })
                }
                className="campo"
              >
                <option value={1}>A cada 1 minuto (tempo real)</option>
                <option value={3}>A cada 3 minutos</option>
                <option value={5}>A cada 5 minutos (recomendado)</option>
                <option value={10}>A cada 10 minutos</option>
                <option value={15}>A cada 15 minutos</option>
                <option value={30}>A cada 30 minutos</option>
              </select>
              <p className="mt-1 text-[11px] text-tinta-3">
                Com o Piloto ligado, o sistema busca novas ofertas nas fontes sincronizadas nesse ritmo.
              </p>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-[11px] border border-linha bg-fundo/50 p-3.5">
              <div>
                <p className="text-sm font-semibold text-tinta">Coletar fontes automaticamente</p>
                <p className="text-xs text-tinta-3">Puxa ofertas e cupons das fontes ativas a cada ciclo.</p>
              </div>
              <input
                type="checkbox"
                checked={autoCfg.coletar_rss}
                onChange={(e) => setAutoCfg({ ...autoCfg, coletar_rss: e.target.checked })}
                className="h-4 w-4 accent-fogo"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-[11px] border border-linha bg-fundo/50 p-3.5">
              <div>
                <p className="text-sm font-semibold text-tinta">Disparar aprovadas no Piloto</p>
                <p className="text-xs text-tinta-3">Envia automaticamente itens da coluna Na Fila.</p>
              </div>
              <input
                type="checkbox"
                checked={autoCfg.disparar_aprovadas}
                onChange={(e) => setAutoCfg({ ...autoCfg, disparar_aprovadas: e.target.checked })}
                className="h-4 w-4 accent-fogo"
              />
            </label>

            <button
              type="submit"
              disabled={salvando}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-acao text-sm font-semibold text-acao-texto transition hover:bg-acao-forte disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{salvando ? "Salvando..." : "Salvar regras"}</span>
            </button>
          </form>
        )}
      </Gaveta>

      {/* GAVETA: ESCOLHER GRUPOS DE DESTINO PARA DISPARO */}
      <Gaveta
        aberta={gavetaDestinos}
        onFechar={() => setGavetaDestinos(false)}
        titulo="Escolher grupos de destino"
        subtitulo="Marque 1 ou mais grupos do WhatsApp onde os disparos da Esteira vão cair."
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-3" />
            <input
              value={buscaDestino}
              onChange={(e) => setBuscaDestino(e.target.value)}
              placeholder={`Buscar entre ${gruposWa.length} grupos...`}
              className="campo !pl-9 text-xs"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-tinta-3">
            <span>{destinosSelecionados.length} selecionado(s)</span>
            {destinosSelecionados.length > 0 && (
              <button
                type="button"
                onClick={() => setDestinosSelecionados([])}
                className="font-semibold text-fogo hover:underline"
              >
                Limpar seleção
              </button>
            )}
          </div>

          <div className="space-y-1.5 pb-4">
            {gruposFiltradosDestino.map((g) => {
              const ativo = destinosSelecionados.includes(g.jid);
              return (
                <div
                  key={g.jid}
                  className={`flex items-center justify-between gap-2 rounded-[10px] border p-3 transition ${
                    ativo ? "border-ok/40 bg-ok-suave/50" : "border-linha bg-fundo/50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-tinta">
                      {g.nome} {g.souAdmin ? "★" : ""}
                    </p>
                    <p className="text-[11px] text-tinta-3">
                      {g.participantes} membros {g.souAdmin ? "· Você é Admin" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => alternarDestino(g.jid)}
                    className={`shrink-0 rounded-[8px] px-3 py-1.5 text-xs font-semibold transition ${
                      ativo
                        ? "bg-ok text-white"
                        : "border border-linha-forte bg-superficie text-tinta hover:border-fogo hover:text-fogo"
                    }`}
                  >
                    {ativo ? "Selecionado ✓" : "Escolher"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </Gaveta>
    </div>
  );
}

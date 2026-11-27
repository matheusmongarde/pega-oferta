"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Gaveta } from "@/components/ui/gaveta";
import {
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Plug,
  Plus,
  QrCode,
  RefreshCw,
  Smartphone,
  Terminal,
  Trash2,
} from "lucide-react";

interface Conexao {
  id: string;
  tipo: "telegram" | "whatsapp_baileys" | "whatsapp_evolution" | "whatsapp_zapi" | "webhook";
  nome: string;
  destino: string;
  endpoint: string;
  token: string;
  instancia: string;
  ativa: number;
  ultimo_status: string;
}

interface InstanciaBaileys {
  id: string;
  nome: string;
  estado: string;
  qr: string | null;
  numero: string | null;
  grupos_count?: number;
}

interface StatusBaileys {
  online: boolean;
  estado: string;
  qr: string | null;
  numero: string | null;
  instancias?: InstanciaBaileys[];
}

interface ApiTokenItem {
  id: string;
  nome: string;
  token_preview: string;
  escopos: string;
  ultimo_uso: string | null;
  criado_em: string;
}

const LABELS_TIPO: Record<Conexao["tipo"], string> = {
  telegram: "Telegram (Bot API)",
  whatsapp_baileys: "WhatsApp QR (Baileys)",
  whatsapp_evolution: "WhatsApp (Evolution API)",
  whatsapp_zapi: "WhatsApp (Z-API)",
  webhook: "Webhook (n8n / Make)",
};

export default function ConexoesPage() {
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [gaveta, setGaveta] = useState(false);
  const [gavetaNovoWa, setGavetaNovoWa] = useState(false);
  const [nomeNovoWa, setNomeNovoWa] = useState("");
  const [baileys, setBaileys] = useState<StatusBaileys>({
    online: false,
    estado: "offline",
    qr: null,
    numero: null,
    instancias: [],
  });
  const [tipo, setTipo] = useState<Conexao["tipo"]>("telegram");
  const [nome, setNome] = useState("");
  const [destino, setDestino] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");
  const [instancia, setInstancia] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [testandoId, setTestandoId] = useState<string | null>(null);
  const [acaoWaId, setAcaoWaId] = useState<string | null>(null);

  // API Tokens para IAs / OpenBot
  const [tokensApi, setTokensApi] = useState<ApiTokenItem[]>([]);
  const [nomeNovoToken, setNomeNovoToken] = useState("");
  const [criandoToken, setCriandoToken] = useState(false);
  const [tokenRecemCriado, setTokenRecemCriado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    const [cnxRes, waRes, tokRes] = await Promise.all([
      fetch("/api/conexoes"),
      fetch("/api/whatsapp/baileys").catch(() => null),
      fetch("/api/tokens").catch(() => null),
    ]);
    const data = (await cnxRes.json()) as { conexoes: Conexao[] };
    setConexoes(data.conexoes || []);
    if (waRes && waRes.ok) {
      setBaileys((await waRes.json()) as StatusBaileys);
    }
    if (tokRes && tokRes.ok) {
      const td = (await tokRes.json()) as { tokens?: ApiTokenItem[] };
      setTokensApi(td.tokens || []);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Atualiza automaticamente a cada 3s enquanto alguma instancia estiver aguardando QR ou reconectando
  useEffect(() => {
    const aguardando = (baileys.instancias || []).some(
      (i) => i.estado === "aguardando_qr" || i.estado === "reconectando"
    );
    if (!aguardando) return;
    const t = window.setInterval(() => {
      carregar().catch(() => {});
    }, 3000);
    return () => window.clearInterval(t);
  }, [baileys.instancias, carregar]);

  async function acaoBaileys(acao: "conectar" | "desconectar", instanciaId = "principal") {
    setAcaoWaId(instanciaId);
    setAviso(null);
    try {
      const res = await fetch("/api/whatsapp/baileys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, instancia: instanciaId }),
      });
      const data = (await res.json()) as { erro?: string };
      if (!res.ok && data.erro) setAviso(data.erro);
      else
        setAviso(
          acao === "conectar"
            ? "Gerando QR Code... aguarde 2 segundos e escaneie no WhatsApp."
            : "Sessão desconectada."
        );
      await carregar();
    } finally {
      setAcaoWaId(null);
    }
  }

  async function criarNovoWhatsapp(e: React.FormEvent) {
    e.preventDefault();
    setAcaoWaId("nova");
    setAviso(null);
    try {
      const res = await fetch("/api/whatsapp/baileys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "conectar",
          nova: true,
          nome: nomeNovoWa.trim() || `WhatsApp ${(baileys.instancias?.length || 1) + 1}`,
        }),
      });
      const data = (await res.json()) as { erro?: string };
      if (!res.ok && data.erro) {
        setAviso(data.erro);
      } else {
        setNomeNovoWa("");
        setGavetaNovoWa(false);
        setAviso("Novo WhatsApp criado! Escaneie o QR Code que apareceu no card abaixo.");
      }
      await carregar();
    } finally {
      setAcaoWaId(null);
    }
  }

  async function gerarTokenApi(e: React.FormEvent) {
    e.preventDefault();
    setCriandoToken(true);
    setTokenRecemCriado(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nomeNovoToken.trim() || "OpenBot / IA" }),
      });
      const data = (await res.json()) as { token?: { token: string } };
      if (data.token?.token) {
        setTokenRecemCriado(data.token.token);
        setNomeNovoToken("");
        setAviso("Token criado! Copie agora — ele não será exibido por inteiro novamente.");
        await carregar();
      }
    } finally {
      setCriandoToken(false);
    }
  }

  async function revogarToken(id: string) {
    await fetch(`/api/tokens?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setAviso("Token revogado.");
    await carregar();
  }

  function copiarTexto(texto: string) {
    navigator.clipboard.writeText(texto).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    await fetch("/api/conexoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, nome, destino, endpoint, token, instancia }),
    });
    setNome("");
    setDestino("");
    setEndpoint("");
    setToken("");
    setInstancia("");
    setGaveta(false);
    setAviso("Conexão salva.");
    await carregar();
  }

  async function testar(id: string) {
    setTestandoId(id);
    setAviso(null);
    try {
      const res = await fetch("/api/conexoes/testar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json()) as { ok: boolean; detalhe: string };
      setAviso(data.detalhe);
      await carregar();
    } finally {
      setTestandoId(null);
    }
  }

  async function remover(id: string) {
    await fetch(`/api/conexoes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await carregar();
  }

  const instanciasWa: InstanciaBaileys[] =
    baileys.instancias && baileys.instancias.length > 0
      ? baileys.instancias
      : [
          {
            id: "principal",
            nome: "WhatsApp Principal",
            estado: baileys.estado,
            qr: baileys.qr,
            numero: baileys.numero,
          },
        ];

  const totalWaConectados = instanciasWa.filter((i) => i.estado === "conectado").length;

  return (
    <div className="space-y-6">
      <PageHeader
        sobrelinha="AJUSTES · CANAIS & API"
        titulo="Conexões & API."
        subtitulo="Conecte quantos WhatsApps quiser por QR Code, gerencie Telegram/Webhooks e gere tokens para conectar OpenBot ou outras IAs."
        acoes={
          <>
            <button
              type="button"
              onClick={() => setGavetaNovoWa(true)}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-linha-forte bg-superficie px-4 text-sm font-semibold text-tinta transition hover:bg-rebaixo"
            >
              <QrCode className="h-4 w-4" />
              <span>+ Outro WhatsApp (QR)</span>
            </button>
            <button
              type="button"
              onClick={() => setGaveta(true)}
              className="btn-primario"
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar canal</span>
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

      {/* MULTI-WHATSAPP BAILEYS (QR CODE) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="display text-base font-extrabold text-tinta">
              WhatsApps conectados por QR Code ({totalWaConectados}/{instanciasWa.length})
            </h2>
            <p className="text-xs text-tinta-3">
              Você pode conectar múltiplos números (ex.: um para espelhar e outro só para disparar) e escolher qual número cuida de cada grupo na Esteira.
            </p>
          </div>
          <button
            type="button"
            onClick={carregar}
            className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-linha-forte bg-superficie px-3 text-xs font-semibold text-tinta hover:bg-rebaixo"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Atualizar</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {instanciasWa.map((inst, idx) => {
            const conectado = inst.estado === "conectado";
            const ocupado = acaoWaId === inst.id;
            return (
              <article
                key={inst.id}
                className={
                  idx === 0
                    ? "hero-pega p-6 text-white"
                    : "caixa flex flex-col justify-between p-6"
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          idx === 0
                            ? "inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white"
                            : "selo"
                        }
                      >
                        <Smartphone className="h-3 w-3" />
                        <span>{inst.nome}</span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          idx === 0
                            ? "bg-white text-[#181614]"
                            : conectado
                            ? "bg-ok-suave text-ok"
                            : "bg-rebaixo text-tinta-2"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            conectado ? "bg-[#15803d]" : "bg-[#b45309]"
                          }`}
                        />
                        {conectado
                          ? "Conectado ao vivo"
                          : baileys.online
                          ? inst.estado
                          : "Serviço local parado"}
                      </span>
                    </div>

                    <h3
                      className={`display mt-3 text-xl font-extrabold ${
                        idx === 0 ? "text-white" : "text-tinta"
                      }`}
                    >
                      {conectado
                        ? `Ativo (${inst.numero || "pareado"})`
                        : "Aguardando conexão por QR"}
                    </h3>
                    <p
                      className={`mt-1 text-xs ${
                        idx === 0 ? "text-white/80" : "text-tinta-3"
                      }`}
                    >
                      ID: <code className="font-mono">{inst.id}</code>
                      {typeof inst.grupos_count === "number" && conectado
                        ? ` · ${inst.grupos_count} grupo(s) em cache`
                        : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => acaoBaileys(conectado ? "desconectar" : "conectar", inst.id)}
                    className={
                      idx === 0
                        ? "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] bg-white px-4 text-xs font-bold text-[#181614] hover:bg-white/90 disabled:opacity-60"
                        : "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] bg-acao px-4 text-xs font-semibold text-acao-texto hover:bg-acao-forte disabled:opacity-60"
                    }
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>
                      {conectado
                        ? "Desconectar"
                        : ocupado
                        ? "Gerando..."
                        : "Gerar QR Code"}
                    </span>
                  </button>
                </div>

                {inst.qr && (
                  <div className="mt-4 flex flex-col items-center gap-4 rounded-[14px] border border-linha bg-white p-4 text-[#181614] sm:flex-row">
                    <img
                      src={inst.qr}
                      alt={`QR Code ${inst.nome}`}
                      className="h-40 w-40 rounded-lg border border-linha bg-white p-1.5"
                    />
                    <div>
                      <p className="font-display text-sm font-bold">Escaneie no WhatsApp</p>
                      <p className="mt-1 text-xs text-[#57524b]">
                        Abra o WhatsApp → Aparelhos conectados → Conectar um aparelho.
                      </p>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* API & TOKENS PARA IAS, OPENBOT, N8N E MAKE */}
      <section className="caixa p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-fogo" />
              <h2 className="display text-base font-extrabold text-tinta">
                API do Sistema &amp; Tokens (OpenBot, IAs, n8n, Make)
              </h2>
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-tinta-3">
              Gere um token Bearer para conectar o OpenBot, agentes de IA, n8n ou Make diretamente ao seu Pega Oferta — para consultar ofertas, criar ofertas/cupons e disparar nos grupos por API.
            </p>
          </div>
        </div>

        <form onSubmit={gerarTokenApi} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <input
            value={nomeNovoToken}
            onChange={(e) => setNomeNovoToken(e.target.value)}
            placeholder="Nome do token (ex.: OpenBot, Claude, n8n Produção)"
            className="campo flex-1 text-sm"
          />
          <button
            type="submit"
            disabled={criandoToken}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-acao px-4 text-sm font-semibold text-acao-texto hover:bg-acao-forte disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>{criandoToken ? "Gerando..." : "Gerar token de API"}</span>
          </button>
        </form>

        {tokenRecemCriado && (
          <div className="mt-4 rounded-[12px] border border-ok/35 bg-ok-suave p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-ok">
                Token gerado — copie e guarde agora:
              </span>
              <button
                type="button"
                onClick={() => copiarTexto(tokenRecemCriado)}
                className="inline-flex items-center gap-1.5 rounded-[8px] bg-ok px-3 py-1 text-xs font-semibold text-white"
              >
                {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiado ? "Copiado!" : "Copiar token"}</span>
              </button>
            </div>
            <p className="mt-2 break-all rounded-[8px] bg-white/85 px-3 py-2 font-mono text-xs text-[#181614]">
              {tokenRecemCriado}
            </p>
          </div>
        )}

        {tokensApi.length > 0 && (
          <div className="mt-4 divide-y divide-linha rounded-[12px] border border-linha bg-fundo/50">
            {tokensApi.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
              >
                <div>
                  <p className="font-semibold text-tinta">{t.nome}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-tinta-3">
                    {t.token_preview} · escopos: {t.escopos}
                    {t.ultimo_uso ? ` · último uso: ${new Date(t.ultimo_uso).toLocaleString("pt-BR")}` : " · nunca usado"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revogarToken(t.id)}
                  className="inline-flex items-center gap-1 rounded-[8px] border border-linha-forte bg-superficie px-2.5 py-1 text-xs font-semibold text-tinta-2 hover:border-erro hover:text-erro"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Revogar</span>
                </button>
              </div>
            ))}
          </div>
        )}

        <details className="mt-4 rounded-[12px] border border-linha bg-fundo/60 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-tinta">
            <span className="inline-flex items-center gap-2">
              <Terminal className="h-4 w-4 text-fogo" />
              <span>Endpoints prontos da API v1 (Bearer Token)</span>
            </span>
            <span className="text-tinta-3">Ver exemplos</span>
          </summary>
          <div className="mt-3 space-y-2.5 text-xs text-tinta-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-[8px] border border-linha bg-superficie p-2.5 font-mono text-[11px]">
                <strong className="text-ok">GET</strong> /api/v1/status · Saúde e contadores
              </div>
              <div className="rounded-[8px] border border-linha bg-superficie p-2.5 font-mono text-[11px]">
                <strong className="text-ok">GET</strong> /api/v1/grupos · Instâncias e grupos WA
              </div>
              <div className="rounded-[8px] border border-linha bg-superficie p-2.5 font-mono text-[11px]">
                <strong className="text-fogo">POST</strong> /api/v1/ofertas · Criar/parsear oferta
              </div>
              <div className="rounded-[8px] border border-linha bg-superficie p-2.5 font-mono text-[11px]">
                <strong className="text-fogo">POST</strong> /api/v1/disparar · Disparar nos grupos
              </div>
              <div className="rounded-[8px] border border-linha bg-superficie p-2.5 font-mono text-[11px]">
                <strong className="text-ok">GET/POST</strong> /api/v1/cupons · Listar ou salvar cupom
              </div>
            </div>
            <pre className="overflow-x-auto rounded-[10px] bg-rebaixo p-3.5 font-mono text-[11px] leading-relaxed text-tinta">
{`curl -X POST http://localhost:3000/api/v1/ofertas \\
  -H "Authorization: Bearer SEU_TOKEN_PO_LIVE" \\
  -H "Content-Type: application/json" \\
  -d '{"texto": "SSD 1TB R$ 349 https://www.amazon.com.br/dp/B0BBWH1R8H", "disparar": true}'`}
            </pre>
          </div>
        </details>
      </section>

      {/* OUTROS CANAIS CONECTADOS */}
      <section className="caixa divide-y divide-linha overflow-hidden">
        <div className="px-6 py-4">
          <h2 className="display text-base font-extrabold text-tinta">
            Outros canais conectados ({conexoes.length})
          </h2>
        </div>

        {conexoes.map((c) => (
          <div
            key={c.id}
            className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="selo selo-info">
                  <Plug className="h-3 w-3" />
                  {LABELS_TIPO[c.tipo]}
                </span>
                <span
                  className={`selo ${
                    c.ultimo_status === "conectada"
                      ? "selo-ok"
                      : c.ultimo_status === "erro"
                      ? "selo-erro"
                      : "selo-alerta"
                  }`}
                >
                  {c.ultimo_status}
                </span>
              </div>
              <p className="mt-1.5 font-semibold text-tinta">{c.nome}</p>
              <p className="truncate font-mono text-xs text-tinta-3">
                Destino: {c.destino || "—"} {c.endpoint ? `· ${c.endpoint}` : ""}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => testar(c.id)}
                disabled={testandoId === c.id}
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-linha-forte px-3 text-xs font-semibold text-tinta hover:border-fogo"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-fogo" />
                <span>{testandoId === c.id ? "Testando..." : "Testar"}</span>
              </button>
              <button
                type="button"
                onClick={() => remover(c.id)}
                aria-label="Remover conexão"
                className="grid h-9 w-9 place-items-center rounded-[9px] border border-linha-forte text-tinta-3 hover:border-erro hover:text-erro"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* GAVETA: CONECTAR NOVO WHATSAPP BAILEYS */}
      <Gaveta
        aberta={gavetaNovoWa}
        aoFechar={() => setGavetaNovoWa(false)}
        sobrelinha="MULTI-WHATSAPP"
        titulo="Conectar outro WhatsApp (QR)"
        subtitulo="Cada WhatsApp tem sua própria sessão e QR Code. Depois você escolhe qual número dispara em cada grupo."
      >
        <form onSubmit={criarNovoWhatsapp} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-tinta-3">
              Nome deste WhatsApp
            </label>
            <input
              type="text"
              required
              value={nomeNovoWa}
              onChange={(e) => setNomeNovoWa(e.target.value)}
              placeholder="Ex.: WhatsApp Disparos 02, Chip Tech..."
              className="campo"
            />
          </div>
          <button
            type="submit"
            disabled={acaoWaId === "nova"}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-acao px-4 text-sm font-semibold text-acao-texto hover:bg-acao-forte disabled:opacity-50"
          >
            <QrCode className="h-4 w-4" />
            <span>{acaoWaId === "nova" ? "Criando..." : "Criar e gerar QR Code"}</span>
          </button>
        </form>
      </Gaveta>

      {/* GAVETA: ADICIONAR OUTRO CANAL */}
      <Gaveta
        aberta={gaveta}
        aoFechar={() => setGaveta(false)}
        sobrelinha="CONEXÕES"
        titulo="Adicionar canal de envio"
        subtitulo="Telegram Bot API, Evolution API, Z-API ou Webhook."
      >
        <form onSubmit={salvar} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-tinta-3">
              Canal
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as Conexao["tipo"])}
              className="campo"
            >
              <option value="telegram">Telegram (Bot API oficial)</option>
              <option value="whatsapp_evolution">WhatsApp (Evolution API)</option>
              <option value="whatsapp_zapi">WhatsApp (Z-API)</option>
              <option value="webhook">Webhook genérico (n8n / Make)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-tinta-3">
              Nome interno
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Canal Principal Telegram"
              className="campo"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-tinta-3">
              {tipo === "telegram" ? "Canal ou Chat ID (@meu_canal)" : "ID do grupo (@g.us) ou número"}
            </label>
            <input
              type="text"
              required
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder={tipo === "telegram" ? "@meu_canal" : "1203630...@g.us"}
              className="campo font-mono text-sm"
            />
          </div>
          {tipo !== "telegram" && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-tinta-3">
                URL do servidor / Webhook
              </label>
              <input
                type="url"
                required
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://sua-evolution.com"
                className="campo font-mono text-xs"
              />
            </div>
          )}
          {tipo === "whatsapp_evolution" && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-tinta-3">
                Instância
              </label>
              <input
                type="text"
                required
                value={instancia}
                onChange={(e) => setInstancia(e.target.value)}
                placeholder="ofertas-01"
                className="campo font-mono text-sm"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-tinta-3">
              Token / API Key
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Cole o token aqui"
              className="campo font-mono text-sm"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-acao px-4 text-sm font-semibold text-acao-texto hover:bg-acao-forte"
          >
            <Plus className="h-4 w-4" />
            <span>Salvar conexão</span>
          </button>
        </form>
      </Gaveta>
    </div>
  );
}

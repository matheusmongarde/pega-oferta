"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Gaveta } from "@/components/ui/gaveta";
import {
  ESTILOS_LOJA,
  PADRAO_CUPOM_INICIAL,
  limparTextoInterno,
  limparValidadePublica,
  montarLegendaCupom,
  renderizarArteCupomPng,
  type PadraoCupomClient,
} from "@/lib/cupom-arte";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ImagePlus,
  Link2,
  Palette,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Send,
  Ticket,
  Trash2,
} from "lucide-react";

interface Cupom {
  id: string;
  codigo: string;
  loja: string;
  descricao: string;
  valor_minimo: number;
  status: "ativo" | "acabando" | "expirado";
  reportes_expirado: number;
  validade: string;
}

interface GrupoWa {
  jid: string;
  nome: string;
  participantes: number;
  souAdmin?: boolean;
}

export default function CuponsPage() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [gavetaNovo, setGavetaNovo] = useState(false);
  const [gruposEspelhados, setGruposEspelhados] = useState(0);
  const [gruposWa, setGruposWa] = useState<GrupoWa[]>([]);
  const [waConectado, setWaConectado] = useState(false);
  const [arroba, setArroba] = useState("@pegaoferta");
  const [logoProjeto, setLogoProjeto] = useState("");

  // Padrao editavel de arte e mensagem
  const [padrao, setPadrao] = useState<PadraoCupomClient>(PADRAO_CUPOM_INICIAL);
  const [linksResolvidos, setLinksResolvidos] = useState<Record<string, string>>({});
  const [salvandoPadrao, setSalvandoPadrao] = useState(false);
  const [padraoSalvoMsg, setPadraoSalvoMsg] = useState<string | null>(null);

  // Form novo cupom
  const [codigo, setCodigo] = useState("");
  const [loja, setLoja] = useState("mercadolivre");
  const [descricao, setDescricao] = useState("");
  const [valorMin, setValorMin] = useState("0");
  const [validade, setValidade] = useState("Ate acabar a verba");
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Gaveta disparo com arte
  const [cupomDisparo, setCupomDisparo] = useState<Cupom | null>(null);
  const [abaEditor, setAbaEditor] = useState<"mensagem" | "arte">("mensagem");
  const [linkCupom, setLinkCupom] = useState("");
  const [mensagemTexto, setMensagemTexto] = useState("");
  const [mensagemEditadaManual, setMensagemEditadaManual] = useState(false);
  const [artePreview, setArtePreview] = useState<string>("");
  const [destinosSel, setDestinosSel] = useState<string[]>([]);
  const [disparando, setDisparando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const inputFundoRef = useRef<HTMLInputElement | null>(null);

  const carregar = useCallback(async () => {
    const [resCup, resWa, resCfg, resPad] = await Promise.all([
      fetch("/api/cupons"),
      fetch("/api/whatsapp/baileys").catch(() => null),
      fetch("/api/config").catch(() => null),
      fetch("/api/cupons/padrao").catch(() => null),
    ]);
    const data = (await resCup.json()) as { cupons: Cupom[] };
    setCupons(data.cupons || []);

    if (resWa && resWa.ok) {
      const w = (await resWa.json()) as {
        estado?: string;
        grupos_espelhados?: string[];
        grupos?: GrupoWa[];
      };
      setWaConectado(w.estado === "conectado");
      setGruposEspelhados((w.grupos_espelhados || []).length);
      const ordenados = [...(w.grupos || [])].sort(
        (a, b) => Number(Boolean(b.souAdmin)) - Number(Boolean(a.souAdmin))
      );
      setGruposWa(ordenados);
    }

    if (resCfg && resCfg.ok) {
      const c = (await resCfg.json()) as {
        config?: { arroba_marca?: string; logo_data_url?: string };
      };
      if (c.config?.arroba_marca) setArroba(c.config.arroba_marca);
      if (typeof c.config?.logo_data_url === "string") setLogoProjeto(c.config.logo_data_url);
    }

    if (resPad && resPad.ok) {
      const p = (await resPad.json()) as {
        padrao?: PadraoCupomClient;
        linksResolvidos?: Record<string, string>;
      };
      if (p.padrao) setPadrao(p.padrao);
      if (p.linksResolvidos) setLinksResolvidos(p.linksResolvidos);
    }
  }, []);

  useEffect(() => {
    carregar();
    const id = window.setInterval(() => {
      carregar().catch(() => {});
    }, 15000);
    return () => window.clearInterval(id);
  }, [carregar]);

  // Atualiza a arte PNG ao vivo sempre que o cupom ou o padrao mudarem
  useEffect(() => {
    if (!cupomDisparo) return;
    let ativo = true;
    renderizarArteCupomPng({
      codigo: cupomDisparo.codigo,
      loja: cupomDisparo.loja,
      arroba,
      logoProjetoDataUrl: logoProjeto,
      valorMinimo: cupomDisparo.valor_minimo,
      validade: cupomDisparo.validade,
      padrao,
    }).then((dataUrl) => {
      if (ativo) setArtePreview(dataUrl);
    });
    return () => {
      ativo = false;
    };
  }, [cupomDisparo, padrao, arroba, logoProjeto]);

  // Atualiza a mensagem automaticamente quando muda o link ou template (se usuario nao digitou custom)
  useEffect(() => {
    if (!cupomDisparo || mensagemEditadaManual) return;
    setMensagemTexto(
      montarLegendaCupom({
        template: padrao.templateMensagem,
        codigo: cupomDisparo.codigo,
        loja: cupomDisparo.loja,
        link: linkCupom,
        arroba,
        valorMinimo: cupomDisparo.valor_minimo,
        validade: cupomDisparo.validade,
      })
    );
  }, [cupomDisparo, padrao.templateMensagem, linkCupom, arroba, mensagemEditadaManual]);

  function abrirDisparo(c: Cupom) {
    const linkInicial = linksResolvidos[c.loja] || padrao.linksPorLoja?.[c.loja] || "";
    setCupomDisparo(c);
    setAbaEditor("mensagem");
    setLinkCupom(linkInicial);
    setMensagemEditadaManual(false);
    setPadraoSalvoMsg(null);
    setMensagemTexto(
      montarLegendaCupom({
        template: padrao.templateMensagem,
        codigo: c.codigo,
        loja: c.loja,
        link: linkInicial,
        arroba,
        valorMinimo: c.valor_minimo,
        validade: c.validade,
      })
    );
    const admins = gruposWa.filter((g) => g.souAdmin).map((g) => g.jid);
    setDestinosSel(admins.length > 0 ? admins : []);
  }

  function handleUploadFundo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (dataUrl) {
        setPadrao((prev) => ({
          ...prev,
          estilo: "personalizado",
          fundoDataUrl: dataUrl,
        }));
      }
    };
    reader.readAsDataURL(file);
  }

  async function salvarMeuPadrao() {
    setSalvandoPadrao(true);
    setPadraoSalvoMsg(null);
    try {
      const payload: PadraoCupomClient = {
        ...padrao,
        linksPorLoja: cupomDisparo
          ? { ...padrao.linksPorLoja, [cupomDisparo.loja]: linkCupom.trim() }
          : padrao.linksPorLoja,
      };
      const res = await fetch("/api/cupons/padrao", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const d = (await res.json()) as {
          padrao?: PadraoCupomClient;
          linksResolvidos?: Record<string, string>;
        };
        if (d.padrao) setPadrao(d.padrao);
        if (d.linksResolvidos) setLinksResolvidos(d.linksResolvidos);
        setPadraoSalvoMsg("Padrão de arte e mensagem salvo para os próximos cupons.");
      }
    } finally {
      setSalvandoPadrao(false);
    }
  }

  async function restaurarPadrao() {
    setPadrao(PADRAO_CUPOM_INICIAL);
    setMensagemEditadaManual(false);
    setPadraoSalvoMsg("Padrão restaurado (clique em Salvar para fixar).");
  }

  async function dispararCupom() {
    if (!cupomDisparo || destinosSel.length === 0 || disparando) return;
    setDisparando(true);
    setAviso(null);
    try {
      const res = await fetch(`/api/cupons/${cupomDisparo.id}/disparar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinos: destinosSel,
          imagem_base64: artePreview,
          mensagem_custom: mensagemTexto.trim(),
          link_cupom: linkCupom.trim(),
        }),
      });
      const d = (await res.json()) as { ok?: boolean; enviados?: number; total?: number; erro?: string };
      setAviso(
        d.ok
          ? `Cupom ${cupomDisparo.codigo} enviado com arte para ${d.enviados}/${d.total} grupo(s)!`
          : d.erro || "Falha ao disparar cupom."
      );
      if (d.ok) setCupomDisparo(null);
    } finally {
      setDisparando(false);
    }
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim()) return;
    await fetch("/api/cupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo,
        loja,
        descricao,
        valor_minimo: Number(valorMin) || 0,
        validade,
      }),
    });
    setCodigo("");
    setDescricao("");
    setGavetaNovo(false);
    setAviso("Cupom adicionado ao Radar.");
    await carregar();
  }

  async function mudarStatus(id: string, status: Cupom["status"]) {
    await fetch("/api/cupons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await carregar();
  }

  async function remover(id: string) {
    await fetch(`/api/cupons?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await carregar();
  }

  function copiar(c: Cupom) {
    navigator.clipboard.writeText(c.codigo);
    setCopiadoId(c.id);
    setTimeout(() => setCopiadoId(null), 1500);
  }

  function baixarArte() {
    if (!artePreview || !cupomDisparo) return;
    const a = document.createElement("a");
    a.href = artePreview;
    a.download = `cupom-${cupomDisparo.loja}-${cupomDisparo.codigo}.png`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        sobrelinha="RADAR AUTOMATICO · CUPONS"
        titulo="Radar de Cupons."
        subtitulo="Cupons capturados dos seus grupos espelhados entram aqui prontos para disparar com logo da loja, seu link e seu padrão de arte."
        acoes={
          <button
            type="button"
            onClick={() => setGavetaNovo(true)}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-acao px-4 text-sm font-semibold text-acao-texto transition hover:bg-acao-forte"
          >
            <Plus className="h-4 w-4" />
            <span>Novo cupom</span>
          </button>
        }
      />

      {/* Barra de status da captura automatica */}
      <div className="caixa flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs">
        <div className="flex items-center gap-2.5">
          <Radio
            className={`h-4 w-4 ${waConectado && gruposEspelhados > 0 ? "text-ok" : "text-tinta-3"}`}
          />
          <span className="text-tinta-2">
            {waConectado && gruposEspelhados > 0 ? (
              <>
                Captura automática ativa em{" "}
                <strong className="text-tinta">{gruposEspelhados} grupo(s)</strong> espelhados. Clique
                em <strong className="text-tinta">Disparar com arte</strong> para personalizar seu
                padrão e enviar.
              </>
            ) : (
              <>
                Nenhum grupo espelhado ativo ainda. Ligue um grupo em{" "}
                <Link href="/fontes" className="font-semibold text-fogo underline">
                  1. Fontes & Espelho
                </Link>{" "}
                para capturar cupons automaticamente.
              </>
            )}
          </span>
        </div>
      </div>

      {aviso && (
        <div className="flex items-center gap-2 rounded-[12px] border border-ok/30 bg-ok-suave px-4 py-3 text-sm font-medium text-ok">
          <Check className="h-4 w-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {cupons.length === 0 ? (
        <div className="caixa flex flex-col items-center justify-center p-12 text-center">
          <Ticket className="h-8 w-8 text-tinta-3" />
          <p className="mt-3 text-sm font-semibold text-tinta">Nenhum cupom no radar</p>
          <p className="mt-1 max-w-md text-xs text-tinta-3">
            Assim que cair um cupom em um grupo espelhado do WhatsApp, ele aparece aqui pronto para
            disparar com a logo da loja e seu link.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cupons.map((c) => {
            const est = ESTILOS_LOJA[c.loja] || ESTILOS_LOJA.outra;
            const valLimpa = limparValidadePublica(c.validade);
            const descInterna = limparTextoInterno(c.descricao);
            return (
              <article
                key={c.id}
                className="caixa caixa-viva flex flex-col justify-between overflow-hidden"
              >
                {/* Faixa visual com logo oficial da loja */}
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ backgroundColor: est.bg, color: est.fg }}
                >
                  {est.logoUrl ? (
                    <span
                      className={`inline-flex items-center ${
                        est.precisaPillClaroNoOficial ? "rounded-md bg-white px-2 py-1" : ""
                      }`}
                    >
                      <img
                        src={est.logoUrl}
                        alt={est.nome}
                        className="h-6 w-auto max-w-[130px] object-contain"
                      />
                    </span>
                  ) : (
                    <span className="text-xs font-bold tracking-wide">{est.nome}</span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      c.status === "ativo"
                        ? "bg-white/95 text-[#15803d]"
                        : c.status === "acabando"
                        ? "bg-white/95 text-[#a16207]"
                        : "bg-white/95 text-[#be123c]"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                {/* Conteudo centralizado */}
                <div className="flex flex-1 flex-col items-center justify-center p-5 text-center">
                  <button
                    type="button"
                    onClick={() => copiar(c)}
                    title="Clique para copiar"
                    className="group flex w-full items-center justify-center gap-2.5 rounded-[12px] border border-dashed border-linha-forte bg-fundo px-4 py-4 transition hover:border-fogo"
                  >
                    <span className="font-mono text-2xl font-extrabold tracking-wider text-tinta">
                      {c.codigo}
                    </span>
                    {copiadoId === c.id ? (
                      <Check className="h-4 w-4 text-ok" />
                    ) : (
                      <Copy className="h-4 w-4 text-tinta-3 group-hover:text-fogo" />
                    )}
                  </button>

                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-tinta-2">
                    {descInterna || `Cupom ativo para compras na ${est.nome}.`}
                  </p>

                  {(c.valor_minimo > 0 || valLimpa) && (
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-tinta-3">
                      {c.valor_minimo > 0 && <span>Min. R$ {c.valor_minimo.toFixed(0)}</span>}
                      {valLimpa && <span>· {valLimpa}</span>}
                    </div>
                  )}
                </div>

                {/* Rodape de acoes */}
                <div className="flex items-center justify-between gap-2 border-t border-linha bg-fundo/40 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => abrirDisparo(c)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[9px] bg-acao px-3 py-2 text-xs font-semibold text-acao-texto transition hover:bg-acao-forte"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Disparar com arte</span>
                  </button>

                  {c.status !== "expirado" ? (
                    <button
                      type="button"
                      onClick={() => mudarStatus(c.id, "expirado")}
                      title="Marcar como expirado"
                      className="grid h-8 w-8 place-items-center rounded-[8px] border border-linha bg-superficie text-tinta-3 transition hover:text-erro"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => mudarStatus(c.id, "ativo")}
                      title="Reativar cupom"
                      className="grid h-8 w-8 place-items-center rounded-[8px] border border-linha bg-superficie text-tinta-3 transition hover:text-ok"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => remover(c.id)}
                    title="Excluir"
                    className="grid h-8 w-8 place-items-center rounded-[8px] border border-linha bg-superficie text-tinta-3 transition hover:text-erro"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Gaveta: Disparar cupom com arte + editor de padrao proprio */}
      <Gaveta
        aberta={Boolean(cupomDisparo)}
        onFechar={() => setCupomDisparo(null)}
        titulo={cupomDisparo ? `Disparar ${cupomDisparo.codigo}` : "Disparar cupom"}
        subtitulo="Personalize sua arte, seu link e o texto do grupo — e salve como padrão."
      >
        {cupomDisparo && (
          <div className="space-y-4">
            {/* Preview ao vivo da arte PNG */}
            {artePreview && (
              <div className="mx-auto max-w-[320px] overflow-hidden rounded-[14px] border border-linha bg-fundo shadow-sm">
                <img src={artePreview} alt="Prévia da arte do cupom" className="w-full object-cover" />
              </div>
            )}

            {/* Alternador: Mensagem & Link vs Visual da Arte */}
            <div className="grid grid-cols-2 gap-1 rounded-[10px] border border-linha bg-fundo p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAbaEditor("mensagem")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-[8px] py-2 transition ${
                  abaEditor === "mensagem"
                    ? "bg-superficie text-tinta shadow-xs"
                    : "text-tinta-3 hover:text-tinta"
                }`}
              >
                <Link2 className="h-3.5 w-3.5" />
                <span>Link & Mensagem</span>
              </button>
              <button
                type="button"
                onClick={() => setAbaEditor("arte")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-[8px] py-2 transition ${
                  abaEditor === "arte"
                    ? "bg-superficie text-tinta shadow-xs"
                    : "text-tinta-3 hover:text-tinta"
                }`}
              >
                <Palette className="h-3.5 w-3.5" />
                <span>Padrão da Arte</span>
              </button>
            </div>

            {abaEditor === "mensagem" ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-tinta-2">
                    Link para testar o cupom (seu link de afiliado)
                  </label>
                  <input
                    value={linkCupom}
                    onChange={(e) => setLinkCupom(e.target.value)}
                    placeholder="https://www.mercadolivre.com.br/cupons"
                    className="campo text-xs"
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-semibold text-tinta-2">
                      Mensagem enviada no WhatsApp
                    </label>
                    {mensagemEditadaManual && (
                      <button
                        type="button"
                        onClick={() => setMensagemEditadaManual(false)}
                        className="text-[11px] font-medium text-fogo hover:underline"
                      >
                        Voltar ao template
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={5}
                    value={mensagemTexto}
                    onChange={(e) => {
                      setMensagemTexto(e.target.value);
                      setMensagemEditadaManual(true);
                    }}
                    className="campo font-mono text-xs leading-relaxed"
                  />
                  <p className="mt-1 text-[11px] text-tinta-3">
                    Variáveis no template padrão: <code>{"{loja}"}</code>, <code>{"{codigo}"}</code>,{" "}
                    <code>{"{link}"}</code>, <code>{"{arroba}"}</code>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-tinta-2">
                    Estilo da arte
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {(
                      [
                        { id: "oficial", label: "Oficial loja" },
                        { id: "dark", label: "Dark Impacto" },
                        { id: "personalizado", label: "Minha imagem" },
                      ] as const
                    ).map((op) => (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setPadrao((p) => ({ ...p, estilo: op.id }))}
                        className={`rounded-[9px] border px-2.5 py-2 font-semibold transition ${
                          padrao.estilo === op.id
                            ? "border-fogo bg-fogo/10 text-fogo"
                            : "border-linha bg-superficie text-tinta-2 hover:bg-fundo"
                        }`}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>

                {padrao.estilo === "personalizado" && (
                  <div className="rounded-[10px] border border-dashed border-linha-forte bg-fundo p-3 text-center">
                    <input
                      ref={inputFundoRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleUploadFundo}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => inputFundoRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-[8px] border border-linha-forte bg-superficie px-3 py-1.5 text-xs font-semibold text-tinta hover:bg-rebaixo"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      <span>
                        {padrao.fundoDataUrl ? "Trocar imagem de fundo" : "Subir minha arte base (PNG/JPG)"}
                      </span>
                    </button>
                    <p className="mt-1 text-[11px] text-tinta-3">
                      O sistema encaixa o código do cupom por cima da sua imagem.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-tinta-2">
                      Faixa / Título
                    </label>
                    <input
                      value={padrao.titulo}
                      onChange={(e) => setPadrao((p) => ({ ...p, titulo: e.target.value }))}
                      placeholder="CUPOM NOVO"
                      className="campo text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-tinta-2">
                      Subtítulo
                    </label>
                    <input
                      value={padrao.subtitulo}
                      onChange={(e) => setPadrao((p) => ({ ...p, subtitulo: e.target.value }))}
                      placeholder="Aplique no carrinho"
                      className="campo text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-tinta-2">
                    Chamada inferior na arte
                  </label>
                  <input
                    value={padrao.chamada}
                    onChange={(e) => setPadrao((p) => ({ ...p, chamada: e.target.value }))}
                    placeholder="Teste agora no link da mensagem"
                    className="campo text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-tinta-2">
                    Template padrão de texto (para todos os cupons)
                  </label>
                  <textarea
                    rows={4}
                    value={padrao.templateMensagem}
                    onChange={(e) => {
                      setPadrao((p) => ({ ...p, templateMensagem: e.target.value }));
                      setMensagemEditadaManual(false);
                    }}
                    className="campo font-mono text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-tinta-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={padrao.mostrarLogoLoja}
                      onChange={(e) =>
                        setPadrao((p) => ({ ...p, mostrarLogoLoja: e.target.checked }))
                      }
                      className="accent-fogo"
                    />
                    <span>Mostrar logo da loja</span>
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={padrao.mostrarArroba}
                      onChange={(e) =>
                        setPadrao((p) => ({ ...p, mostrarArroba: e.target.checked }))
                      }
                      className="accent-fogo"
                    />
                    <span>Mostrar logo do projeto + {arroba}</span>
                  </label>
                </div>
                <p className="text-[11px] text-tinta-3">
                  A logo do rodapé usa automaticamente a logo do seu projeto — troque em{" "}
                  <Link href="/marcas" className="font-semibold text-fogo underline">
                    Contas de Afiliado
                  </Link>
                  .
                </p>
              </div>
            )}

            {/* Salvar / Restaurar padrao */}
            <div className="flex items-center justify-between gap-2 rounded-[10px] border border-linha bg-fundo/60 px-3 py-2">
              <button
                type="button"
                disabled={salvandoPadrao}
                onClick={salvarMeuPadrao}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-fogo hover:underline disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{salvandoPadrao ? "Salvando..." : "Salvar como meu padrão"}</span>
              </button>
              <button
                type="button"
                onClick={restaurarPadrao}
                className="text-[11px] font-medium text-tinta-3 hover:text-tinta"
              >
                Restaurar padrão
              </button>
            </div>

            {padraoSalvoMsg && (
              <p className="text-xs font-medium text-ok">{padraoSalvoMsg}</p>
            )}

            {/* Escolha de grupos */}
            <div>
              <p className="mb-2 text-xs font-semibold text-tinta-2">
                Escolha os grupos do WhatsApp ({destinosSel.length} selecionados):
              </p>
              {gruposWa.length === 0 ? (
                <p className="rounded-[10px] border border-linha bg-fundo p-3 text-xs text-tinta-3">
                  Conecte seu WhatsApp em{" "}
                  <Link href="/conexoes" className="font-semibold text-fogo underline">
                    WhatsApp & Canais
                  </Link>{" "}
                  para disparar direto, ou baixe a arte abaixo.
                </p>
              ) : (
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-[10px] border border-linha p-2">
                  {gruposWa.map((g) => {
                    const marcado = destinosSel.includes(g.jid);
                    return (
                      <label
                        key={g.jid}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-[8px] px-2.5 py-1.5 text-xs hover:bg-fundo"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() =>
                              setDestinosSel((prev) =>
                                prev.includes(g.jid)
                                  ? prev.filter((x) => x !== g.jid)
                                  : [...prev, g.jid]
                              )
                            }
                            className="accent-fogo"
                          />
                          <span className="truncate font-medium text-tinta">{g.nome}</span>
                        </div>
                        {g.souAdmin && (
                          <span className="rounded bg-ok-suave px-1.5 py-0.5 text-[10px] font-bold text-ok">
                            Admin
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={baixarArte}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-linha-forte bg-superficie px-4 text-xs font-semibold text-tinta transition hover:bg-rebaixo"
              >
                <Download className="h-4 w-4" />
                <span>Baixar PNG</span>
              </button>
              <button
                type="button"
                disabled={disparando || destinosSel.length === 0}
                onClick={dispararCupom}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-acao px-4 text-xs font-semibold text-acao-texto transition hover:bg-acao-forte disabled:opacity-45"
              >
                <Send className="h-4 w-4" />
                <span>{disparando ? "Enviando..." : "Enviar nos grupos"}</span>
              </button>
            </div>
          </div>
        )}
      </Gaveta>

      {/* Gaveta: Novo cupom manual */}
      <Gaveta
        aberta={gavetaNovo}
        onFechar={() => setGavetaNovo(false)}
        titulo="Cadastrar cupom"
        subtitulo="Adicione manualmente um cupom para aparecer na vitrine e disparar com arte."
      >
        <form onSubmit={adicionar} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-tinta-2">Código do cupom</label>
            <input
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ex: MELI20"
              className="campo font-mono uppercase"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-tinta-2">Loja</label>
            <select value={loja} onChange={(e) => setLoja(e.target.value)} className="campo">
              {Object.entries(ESTILOS_LOJA).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-tinta-2">Regra / Desconto</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: R$ 20 OFF acima de R$ 150"
              className="campo"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-tinta-2">Mínimo (R$)</label>
              <input
                type="number"
                value={valorMin}
                onChange={(e) => setValorMin(e.target.value)}
                className="campo"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-tinta-2">Validade</label>
              <input
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                className="campo"
              />
            </div>
          </div>
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-acao text-sm font-semibold text-acao-texto transition hover:bg-acao-forte"
          >
            <Plus className="h-4 w-4" />
            <span>Salvar cupom</span>
          </button>
        </form>
      </Gaveta>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AvatarLogo } from "@/components/ui/avatar-logo";
import { ArrowRight, Check, QrCode, Radio, Save, Sparkles } from "lucide-react";

const PASSOS = [
  { id: "whatsapp", nome: "WhatsApp" },
  { id: "afiliados", nome: "Afiliados" },
  { id: "fontes", nome: "Fontes BR" },
  { id: "pronto", nome: "Pronto" },
] as const;

type PassoId = (typeof PASSOS)[number]["id"];

const PACOTE_GRATUITO = [
  { nome: "Promobit · Ofertas do Dia", url: "https://www.promobit.com.br/" },
  { nome: "Promobit · Central de Cupons", url: "https://www.promobit.com.br/cupons/" },
  { nome: "Canaltech · Tech & Ofertas RSS", url: "https://canaltech.com.br/rss/" },
  { nome: "Adrenaline · Hardware & PC Gamer", url: "https://www.adrenaline.com.br/feed/" },
];

const chaveUrl = (u: string) =>
  u.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");

export default function PassoOnboardingPage() {
  const params = useParams<{ passo: string }>();
  const passoAtual = (PASSOS.some((p) => p.id === params.passo) ? params.passo : "whatsapp") as PassoId;
  const idx = PASSOS.findIndex((p) => p.id === passoAtual);
  const proximo = PASSOS[idx + 1] ? `/instalar/${PASSOS[idx + 1].id}` : "/";

  // Estado WhatsApp
  const [waEstado, setWaEstado] = useState("desconectado");
  const [waNumero, setWaNumero] = useState<string | null>(null);
  const [waQr, setWaQr] = useState<string | null>(null);
  const [gerandoQr, setGerandoQr] = useState(false);

  // Estado Afiliados
  const [marcaId, setMarcaId] = useState<string | null>(null);
  const [amazonTag, setAmazonTag] = useState("");
  const [mlTag, setMlTag] = useState("");
  const [shopeeId, setShopeeId] = useState("");
  const [salvandoTags, setSalvandoTags] = useState(false);
  const [tagsSalvas, setTagsSalvas] = useState(false);

  // Estado Fontes
  const [fontesAtivas, setFontesAtivas] = useState(0);
  const [urlsAtivas, setUrlsAtivas] = useState<string[]>([]);
  const [ativandoFontes, setAtivandoFontes] = useState(false);

  const carregar = useCallback(async () => {
    const [resWa, resMarcas, resFontes] = await Promise.all([
      fetch("/api/whatsapp/baileys").catch(() => null),
      fetch("/api/marcas").catch(() => null),
      fetch("/api/fontes").catch(() => null),
    ]);
    if (resWa && resWa.ok) {
      const w = (await resWa.json()) as { estado?: string; numero?: string | null; qr?: string | null };
      setWaEstado(w.estado || "desconectado");
      setWaNumero(w.numero || null);
      setWaQr(w.qr || null);
    }
    if (resMarcas && resMarcas.ok) {
      const m = (await resMarcas.json()) as {
        marcas?: Array<{ id: string; amazon_tag?: string; mercadolivre_tag?: string; shopee_id?: string }>;
      };
      const primeira = m.marcas?.[0];
      if (primeira) {
        setMarcaId(primeira.id);
        setAmazonTag(primeira.amazon_tag && !/suatag|pegaoferta/i.test(primeira.amazon_tag) ? primeira.amazon_tag : "");
        setMlTag(primeira.mercadolivre_tag && !/sua_tag/i.test(primeira.mercadolivre_tag) ? primeira.mercadolivre_tag : "");
        setShopeeId(primeira.shopee_id && !/seu_id/i.test(primeira.shopee_id) ? primeira.shopee_id : "");
      }
    }
    if (resFontes && resFontes.ok) {
      const f = (await resFontes.json()) as { fontes?: Array<{ ativa: number; url: string }> };
      const ativas = (f.fontes || []).filter((x) => x.ativa === 1);
      setFontesAtivas(ativas.length);
      setUrlsAtivas(ativas.map((x) => chaveUrl(x.url || "")));
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (passoAtual !== "whatsapp" || (waEstado !== "aguardando_qr" && waEstado !== "reconectando")) return;
    const t = window.setInterval(() => carregar().catch(() => {}), 3000);
    return () => window.clearInterval(t);
  }, [passoAtual, waEstado, carregar]);

  async function gerarQrWhatsapp() {
    setGerandoQr(true);
    try {
      await fetch("/api/whatsapp/baileys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "conectar", instancia: "principal" }),
      });
      await carregar();
    } finally {
      setGerandoQr(false);
    }
  }

  async function salvarTags(e: React.FormEvent) {
    e.preventDefault();
    if (!marcaId) return;
    setSalvandoTags(true);
    try {
      await fetch(`/api/marcas/${marcaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amazon_tag: amazonTag.trim(),
          mercadolivre_tag: mlTag.trim(),
          shopee_id: shopeeId.trim(),
        }),
      });
      setTagsSalvas(true);
    } finally {
      setSalvandoTags(false);
    }
  }

  const pacoteAtivo = PACOTE_GRATUITO.every((f) => urlsAtivas.includes(chaveUrl(f.url)));

  async function ativarPacoteGratuito() {
    if (pacoteAtivo) return;
    setAtivandoFontes(true);
    try {
      for (const f of PACOTE_GRATUITO.filter((p) => !urlsAtivas.includes(chaveUrl(p.url)))) {
        await fetch("/api/fontes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: f.nome, tipo: "rss", url: f.url, intervalo_min: 5 }),
        }).catch(() => {});
      }
      await carregar();
    } finally {
      setAtivandoFontes(false);
    }
  }

  const feito: Record<PassoId, boolean> = {
    whatsapp: waEstado === "conectado",
    afiliados: Boolean(amazonTag || mlTag || shopeeId || tagsSalvas),
    fontes: fontesAtivas > 0,
    pronto: false,
  };

  return (
    <div className="min-h-[100svh] bg-fundo px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Topo */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AvatarLogo size={32} />
            <span className="font-display text-base font-extrabold tracking-tight text-tinta">
              pega-oferta
            </span>
          </div>
          <Link href="/" className="text-xs font-semibold text-tinta-3 hover:text-tinta">
            Terminar depois
          </Link>
        </header>

        {/* Barra de passos estilo Central */}
        <ol className="mt-7 flex flex-wrap items-center gap-2" aria-label="Passos">
          <li className="inline-flex items-center gap-1.5 rounded-full bg-ok-suave px-3 py-1 text-xs font-semibold text-ok">
            <Check className="h-3.5 w-3.5" />
            <span>Conta</span>
          </li>
          {PASSOS.map((p, i) => {
            const ativo = p.id === passoAtual;
            const ok = feito[p.id];
            return (
              <li key={p.id}>
                <Link
                  href={`/instalar/${p.id}`}
                  aria-current={ativo ? "step" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    ativo
                      ? "bg-acao text-acao-texto"
                      : ok
                      ? "bg-ok-suave text-ok"
                      : "border border-linha bg-superficie text-tinta-2 hover:text-tinta"
                  }`}
                >
                  {ok ? <Check className="h-3.5 w-3.5" /> : <span>{i + 2}.</span>}
                  <span>{p.nome}</span>
                </Link>
              </li>
            );
          })}
        </ol>

        {/* Corpo do passo */}
        <main className="mt-8 space-y-6">
          {passoAtual === "whatsapp" && (
            <section className="caixa p-6 sm:p-8">
              <p className="sobrelinha">PASSO 2 DE 5 · CONEXÃO</p>
              <h1 className="display mt-1 text-2xl font-extrabold text-tinta">
                Conecte seu WhatsApp por QR Code
              </h1>
              <p className="mt-1.5 text-sm text-tinta-2">
                Com o WhatsApp pareado, você espelha grupos de ofertas e dispara com foto nos grupos que administra. Depois dá pra conectar mais números em Conexões.
              </p>

              <div className="mt-6 rounded-[14px] border border-linha bg-fundo/70 p-5">
                {waEstado === "conectado" ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-ok-suave text-ok">
                        <Check className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-tinta">WhatsApp conectado!</p>
                        <p className="text-xs text-tinta-3">Número ativo: {waNumero || "pareado"}</p>
                      </div>
                    </div>
                    <span className="selo selo-ok">Online</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button
                      type="button"
                      disabled={gerandoQr}
                      onClick={gerarQrWhatsapp}
                      className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-acao px-5 text-sm font-semibold text-acao-texto hover:bg-acao-forte disabled:opacity-50"
                    >
                      <QrCode className="h-4 w-4" />
                      <span>{gerandoQr ? "Gerando QR Code..." : "Gerar QR Code agora"}</span>
                    </button>

                    {waQr && (
                      <div className="flex flex-col items-center gap-4 rounded-[12px] border border-linha bg-white p-4 sm:flex-row">
                        <img src={waQr} alt="QR Code WhatsApp" className="h-44 w-44 rounded-lg" />
                        <p className="text-xs leading-relaxed text-tinta-2">
                          Abra o WhatsApp no celular → <strong>Aparelhos conectados</strong> →{" "}
                          <strong>Conectar um aparelho</strong> e aponte a câmera.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {passoAtual === "afiliados" && (
            <section className="caixa p-6 sm:p-8">
              <p className="sobrelinha">PASSO 3 DE 5 · COMISSÕES</p>
              <h1 className="display mt-1 text-2xl font-extrabold text-tinta">
                Suas tags de afiliado
              </h1>
              <p className="mt-1.5 text-sm text-tinta-2">
                Preencha as lojas que você já usa (pode deixar em branco as outras). Em Contas de Afiliado também tem extrator automático de link e editor de mensagem.
              </p>

              <form onSubmit={salvarTags} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-tinta-2">
                    Amazon Associados (ex.: seucanal-20)
                  </label>
                  <input
                    value={amazonTag}
                    onChange={(e) => setAmazonTag(e.target.value)}
                    placeholder="meucanal-20"
                    className="campo font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-tinta-2">
                    Mercado Livre Afiliados (matt_word:matt_tool, ou cole o link gerado)
                  </label>
                  <input
                    value={mlTag}
                    onChange={(e) => setMlTag(e.target.value)}
                    placeholder="seuusuario:12345678"
                    className="campo font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-tinta-2">
                    Shopee Afiliados (Affiliate ID numérico)
                  </label>
                  <input
                    value={shopeeId}
                    onChange={(e) => setShopeeId(e.target.value)}
                    placeholder="18392010293"
                    className="campo font-mono text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={salvandoTags}
                  className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-acao px-5 text-sm font-semibold text-acao-texto hover:bg-acao-forte disabled:opacity-50"
                >
                  {tagsSalvas ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  <span>{salvandoTags ? "Salvando..." : tagsSalvas ? "Tags salvas!" : "Salvar tags"}</span>
                </button>
              </form>
            </section>
          )}

          {passoAtual === "fontes" && (
            <section className="caixa p-6 sm:p-8">
              <p className="sobrelinha">PASSO 4 DE 5 · CAPTAÇÃO</p>
              <h1 className="display mt-1 text-2xl font-extrabold text-tinta">
                Ative fontes gratuitas do Brasil
              </h1>
              <p className="mt-1.5 text-sm text-tinta-2">
                Com 1 clique você já ativa Promobit (Ofertas + Cupons), Canaltech e Adrenaline para abastecer sua Esteira automaticamente.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-linha bg-fundo/70 p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-rebaixo text-tinta">
                    <Radio className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-tinta">
                      {fontesAtivas} fonte(s) ativa(s) no momento
                    </p>
                    <p className="text-xs text-tinta-3">
                      Depois você pode ativar mais 6 fontes BR e APIs oficiais em Fontes &amp; Espelho.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={ativandoFontes || pacoteAtivo}
                  onClick={ativarPacoteGratuito}
                  className={`inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-xs font-semibold disabled:cursor-default ${
                    pacoteAtivo
                      ? "bg-ok/15 text-ok"
                      : "bg-acao text-acao-texto hover:bg-acao-forte disabled:opacity-50"
                  }`}
                >
                  {pacoteAtivo ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  <span>
                    {pacoteAtivo ? "Pacote ativo" : ativandoFontes ? "Ativando..." : "Ativar pacote gratuito BR"}
                  </span>
                </button>
              </div>
            </section>
          )}

          {passoAtual === "pronto" && (
            <section className="space-y-4">
              <div className="caixa p-6 sm:p-8">
                <p className="sobrelinha">PASSO 5 DE 5 · TUDO PRONTO</p>
                <h1 className="display mt-1 text-2xl font-extrabold text-tinta">
                  Sua máquina está pronta
                </h1>
                <p className="mt-1.5 text-sm text-tinta-2">
                  Daqui pra frente as fontes garimpam, você decide o que dispara na Esteira e suas tags garantem a comissão.
                </p>

                <ul className="mt-5 divide-y divide-linha rounded-[12px] border border-linha bg-fundo/60">
                  {[
                    { id: "whatsapp" as PassoId, nome: "WhatsApp QR Code", falta: "conecte para espelhar e disparar" },
                    { id: "afiliados" as PassoId, nome: "Tags de Afiliado", falta: "sem tag o link sai sem comissão" },
                    { id: "fontes" as PassoId, nome: "Fontes Gratuitas BR", falta: "ative para puxar ofertas no automático" },
                  ].map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className={`selo ${feito[item.id] ? "selo-ok" : "selo-alerta"}`}>
                          {feito[item.id] ? "ligado" : "depois"}
                        </span>
                        <strong className="text-tinta">{item.nome}</strong>
                        {!feito[item.id] && <span className="hidden text-tinta-3 sm:inline">· {item.falta}</span>}
                      </div>
                      {!feito[item.id] && (
                        <Link href={`/instalar/${item.id}`} className="font-semibold text-fogo hover:underline">
                          Ligar agora
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/pedagio"
                className="caixa flex items-center justify-between gap-4 p-5 transition hover:border-linha-forte"
              >
                <div>
                  <p className="font-display text-sm font-extrabold text-tinta">
                    Antes de começar, o pedágio
                  </p>
                  <p className="mt-0.5 text-xs text-tinta-3">
                    Quatro cliques que não custam nada e ajudam quem fez (@mongarde_ e @joaoedicao).
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-tinta-3" />
              </Link>

              <div className="flex justify-end">
                <Link
                  href="/"
                  className="inline-flex h-11 items-center gap-2 rounded-[11px] bg-acao px-6 text-sm font-semibold text-acao-texto hover:bg-acao-forte"
                >
                  <span>Entrar no Pega Oferta</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          )}

          {passoAtual !== "pronto" && (
            <div className="flex justify-end">
              <Link
                href={proximo}
                className={`inline-flex h-11 items-center gap-2 rounded-[11px] px-5 text-sm font-semibold transition ${
                  feito[passoAtual]
                    ? "bg-acao text-acao-texto hover:bg-acao-forte"
                    : "border border-linha-forte bg-superficie text-tinta hover:bg-rebaixo"
                }`}
              >
                <span>{feito[passoAtual] ? "Continuar" : "Pular por agora"}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

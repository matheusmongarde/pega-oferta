"use client";

import { useCallback, useEffect, useState } from "react";
import { ShopeeApiCard } from "@/components/shopee-api-card";
import { PageHeader } from "@/components/ui/page-header";
import { Gaveta } from "@/components/ui/gaveta";
import { IdentidadeMarcaCard } from "@/components/identidade-marca";
import { EditorMensagemOferta } from "@/components/editor-mensagem-oferta";
import {
  Check,
  CheckCircle2,
  Circle,
  Edit3,
  ExternalLink,
  Link2,
  Palette,
  Plus,
  Save,
} from "lucide-react";

interface Marca {
  id: string;
  nome: string;
  slug: string;
  nichos: string;
  palavras_bloqueadas: string;
  preco_min: number;
  preco_max: number;
  amazon_tag: string;
  shopee_id: string;
  mercadolivre_tag: string;
  aliexpress_id: string;
  awin_id: string;
  template_mensagem: string;
}

const PLACEHOLDERS = new Set(["suatag-20", "sua_tag_ml", "seu_id_shopee", "pegaoferta-20"]);

function isTagReal(v?: string) {
  const s = (v || "").trim();
  return Boolean(s && !PLACEHOLDERS.has(s.toLowerCase()));
}

export default function MarcasPage() {
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [selecionada, setSelecionada] = useState<Marca | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const [gavetaEditar, setGavetaEditar] = useState(false);
  const [lojaFocada, setLojaFocada] = useState<string>("todas");
  const [gavetaIdentidade, setGavetaIdentidade] = useState(false);
  const [gavetaNova, setGavetaNova] = useState(false);
  const [novoNome, setNovoNome] = useState("");

  // Testador de link ao vivo
  const [urlTeste, setUrlTeste] = useState("");
  const [resultadoTeste, setResultadoTeste] = useState<{
    url_afiliado: string;
    loja: string;
    convertido: boolean;
  } | null>(null);
  const [testando, setTestando] = useState(false);

  // Extrator de tag a partir de um link de afiliado colado na gaveta
  const [linkColado, setLinkColado] = useState("");
  const [msgExtracao, setMsgExtracao] = useState<{ tipo: "ok" | "aviso"; texto: string } | null>(null);

  const GUIAS_LOJAS: Record<
    string,
    {
      alerta?: string;
      passos: string[];
      portalLabel: string;
      portalUrl: string;
      exemploLink: string;
    }
  > = {
    mercadolivre: {
      alerta:
        "Não fica no Mercado Pago! A tag fica na Central de Afiliados do Mercado Livre (Link Builder).",
      passos: [
        "Acesse a Central de Afiliados do Mercado Livre (botão abaixo) com sua conta.",
        "Clique em «Gerador de links», cole o link de qualquer produto e gere seu link de afiliado.",
        "Abra esse link gerado no navegador, copie a URL longa da barra de endereço (que tem matt_word=... e matt_tool=...) e cole no campo abaixo. O ML precisa dos dois pra creditar a venda, e nós extraímos sozinhos!",
      ],
      portalLabel: "Abrir Gerador de Links do Mercado Livre",
      portalUrl: "https://www.mercadolivre.com.br/afiliados/linkbuilder",
      exemploLink: "https://www.mercadolivre.com.br/...?matt_word=seuusuario&matt_tool=12345678",
    },
    amazon: {
      passos: [
        "Entre no painel Amazon Associados Brasil (botão abaixo).",
        "No canto superior direito, copie seu «ID da loja» (sempre termina com -20, ex: seucanal-20).",
        "Ou cole abaixo qualquer link longo gerado no SiteStripe (?tag=seucanal-20).",
      ],
      portalLabel: "Abrir Amazon Associados",
      portalUrl: "https://associados.amazon.com.br/",
      exemploLink: "https://www.amazon.com.br/dp/B0...?tag=seucanal-20",
    },
    shopee: {
      passos: [
        "Entre no Portal Shopee Afiliados Brasil (botão abaixo).",
        "No menu Conta / Perfil, copie seu «Affiliate ID» numérico (ex: 18392010293).",
        "Ou cole abaixo uma URL expandida da Shopee com utm_source=an_18392010293.",
      ],
      portalLabel: "Abrir Shopee Afiliados",
      portalUrl: "https://affiliate.shopee.com.br/",
      exemploLink: "https://shopee.com.br/...?utm_source=an_18392010293",
    },
    aliexpress: {
      passos: [
        "Acesse o painel AliExpress Portals (botão abaixo).",
        "Copie a sua aff_short_key (a chave da conta no AliExpress Portals). O sistema monta o deep link oficial s.click.aliexpress.com sozinho.",
        "Ou cole o link gerado abaixo que extraímos o código automaticamente.",
      ],
      portalLabel: "Abrir AliExpress Portals",
      portalUrl: "https://portals.aliexpress.com/",
      exemploLink: "https://s.click.aliexpress.com/e/_Dm9x1A",
    },
    awin: {
      passos: [
        "Entre no painel Awin (botão abaixo) com sua conta de Publisher.",
        "No topo da tela, ao lado do seu nome, copie o número do seu «Publisher ID» (ex: 1459201).",
        "Ou cole um link awin1.com/cread.php?awinaffid=1459201 abaixo.",
      ],
      portalLabel: "Abrir Painel Awin",
      portalUrl: "https://ui.awin.com/",
      exemploLink: "https://www.awin1.com/cread.php?awinaffid=1459201",
    },
  };

  function extrairTagDoLink(texto: string) {
    setLinkColado(texto);
    setMsgExtracao(null);
    const limpo = texto.trim();
    if (!limpo || !selecionada) return;

    if (/mercadolivre\.com\/sec\/|amzn\.to\/|shope\.ee\/|s\.shopee\.com\.br\//i.test(limpo)) {
      setMsgExtracao({
        tipo: "aviso",
        texto:
          "Esse link está encurtado. Abra ele numa aba do navegador, copie a URL longa da barra de endereço e cole aqui!",
      });
      return;
    }

    try {
      const u = new URL(limpo.startsWith("http") ? limpo : `https://${limpo}`);
      const p = u.searchParams;

      const mattWord = (p.get("matt_word") || "").trim();
      const mattTool = (p.get("matt_tool") || "").trim();
      if (mattWord || mattTool) {
        const valor = mattWord && mattTool ? `${mattWord}:${mattTool}` : mattWord || mattTool;
        setSelecionada({ ...selecionada, mercadolivre_tag: valor });
        setMsgExtracao(
          mattWord && mattTool
            ? { tipo: "ok", texto: `Mercado Livre extraído: usuário ${mattWord} + ID ${mattTool}. Agora clique em Salvar!` }
            : {
                tipo: "aviso",
                texto: `Achei só o ${mattWord ? "matt_word" : "matt_tool"}. O ML precisa dos dois (matt_word e matt_tool) pra creditar a venda: cole o link longo completo do Gerador de Links.`,
              }
        );
        return;
      }

      const amzTag = p.get("tag");
      if (amzTag) {
        setSelecionada({ ...selecionada, amazon_tag: amzTag.trim() });
        setMsgExtracao({
          tipo: "ok",
          texto: `Tag Amazon extraída: ${amzTag.trim()} — agora clique em Salvar!`,
        });
        return;
      }

      const utmShopee = p.get("utm_source") || p.get("af_siteid");
      if (utmShopee && (/shopee/i.test(u.hostname) || /^an_\d+/i.test(utmShopee))) {
        const idNum = utmShopee.replace(/^an_/i, "").trim();
        setSelecionada({ ...selecionada, shopee_id: idNum });
        setMsgExtracao({
          tipo: "ok",
          texto: `ID Shopee extraído: ${idNum} — agora clique em Salvar!`,
        });
        return;
      }

      const awinId = p.get("awinaffid") || p.get("awinmid");
      if (awinId && /awin/i.test(u.hostname)) {
        setSelecionada({ ...selecionada, awin_id: awinId.trim() });
        setMsgExtracao({
          tipo: "ok",
          texto: `Publisher ID Awin extraído: ${awinId.trim()} — agora clique em Salvar!`,
        });
        return;
      }

      const aliKey = p.get("aff_short_key") || u.pathname.match(/\/e\/(_[A-Za-z0-9]+)/)?.[1];
      if (aliKey) {
        setSelecionada({ ...selecionada, aliexpress_id: aliKey.trim() });
        setMsgExtracao({
          tipo: "ok",
          texto: `Código AliExpress extraído: ${aliKey.trim()} — agora clique em Salvar!`,
        });
        return;
      }

      setMsgExtracao({
        tipo: "aviso",
        texto:
          "Não encontrei um código de afiliado nessa URL. Confira se ela tem matt_tool=, tag=, utm_source=an_ ou awinaffid=.",
      });
    } catch {
      /* usuario ainda digitando */
    }
  }

  const carregar = useCallback(async () => {
    const res = await fetch("/api/marcas");
    const data = (await res.json()) as { marcas: Marca[] };
    const lista = data.marcas || [];
    setMarcas(lista);
    setSelecionada((atual) => {
      if (!atual) return lista[0] || null;
      return lista.find((m) => m.id === atual.id) || lista[0] || null;
    });
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!selecionada) return;
    setSalvando(true);
    setAviso(null);
    try {
      const res = await fetch(`/api/marcas/${selecionada.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selecionada),
      });
      if (res.ok) {
        setAviso("Contas de afiliado e template salvos.");
        setGavetaEditar(false);
        await carregar();
      }
    } finally {
      setSalvando(false);
    }
  }

  async function criarMarca(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    const res = await fetch("/api/marcas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoNome.trim() }),
    });
    if (res.ok) {
      setNovoNome("");
      setGavetaNova(false);
      setAviso("Nova marca criada.");
      await carregar();
    }
  }

  async function testarLink(e: React.FormEvent) {
    e.preventDefault();
    if (!urlTeste.trim()) return;
    setTestando(true);
    try {
      const res = await fetch("/api/parser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: urlTeste.trim() }),
      });
      const data = (await res.json()) as {
        parseada?: { url_afiliado: string; loja: string; convertido: boolean };
      };
      if (data.parseada) setResultadoTeste(data.parseada);
    } finally {
      setTestando(false);
    }
  }

  const lojas = selecionada
    ? [
        {
          id: "amazon",
          nome: "Amazon Associados",
          cor: "#131921",
          logo: "/logos/amazon.svg",
          pillClaro: true,
          valor: isTagReal(selecionada.amazon_tag) ? selecionada.amazon_tag : "",
          onde: "Painel Amazon Associados → ID de rastreamento (ex: seunome-20)",
          portal: "https://associados.amazon.com.br/",
        },
        {
          id: "mercadolivre",
          nome: "Mercado Livre Afiliados",
          cor: "#FFE600",
          logo: "/logos/mercadolivre-oficial.png",
          pillClaro: false,
          valor: isTagReal(selecionada.mercadolivre_tag) ? selecionada.mercadolivre_tag : "",
          onde: "Central de Afiliados ML → matt_word + matt_tool do Gerador de Links",
          portal: "https://www.mercadolivre.com.br/afiliados",
        },
        {
          id: "shopee",
          nome: "Shopee Afiliados",
          cor: "#EE4D2D",
          logo: "/logos/shopee.svg",
          pillClaro: true,
          valor: isTagReal(selecionada.shopee_id) ? selecionada.shopee_id : "",
          onde: "Portal Shopee Afiliados → seu ID numerico de afiliado",
          portal: "https://affiliate.shopee.com.br/",
        },
        {
          id: "aliexpress",
          nome: "AliExpress Portals",
          cor: "#E62E04",
          logo: "/logos/aliexpress.svg",
          pillClaro: true,
          valor: isTagReal(selecionada.aliexpress_id) ? selecionada.aliexpress_id : "",
          onde: "AliExpress Portals → aff_short_key",
          portal: "https://portals.aliexpress.com/",
        },
        {
          id: "awin",
          nome: "Awin (Magalu, KaBuM, Nike)",
          cor: "#0086FF",
          logo: "/logos/magalu.png",
          pillClaro: false,
          valor: isTagReal(selecionada.awin_id) ? selecionada.awin_id : "",
          onde: "Painel Awin → Publisher ID",
          portal: "https://ui.awin.com/",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        sobrelinha="COMISSOES & IDENTIDADE"
        titulo="Contas de Afiliado."
        subtitulo="Conecte suas tags da Amazon, Mercado Livre, Shopee, AliExpress e Awin. Enquanto uma loja estiver sem tag, o link vai direto pro produto sem inventar nada."
        acoes={
          <>
            <button
              type="button"
              onClick={() => setGavetaIdentidade(true)}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-linha-forte bg-superficie px-4 text-sm font-semibold text-tinta transition hover:bg-rebaixo"
            >
              <Palette className="h-4 w-4" />
              <span>Logo e @</span>
            </button>
            <button
              type="button"
              onClick={() => setGavetaNova(true)}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-linha-forte bg-superficie px-4 text-sm font-semibold text-tinta transition hover:bg-rebaixo"
            >
              <Plus className="h-4 w-4" />
              <span>Nova marca</span>
            </button>
            {selecionada && (
              <button
                type="button"
                onClick={() => {
                  setLojaFocada("todas");
                  setGavetaEditar(true);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-acao px-4 text-sm font-semibold text-acao-texto transition hover:bg-acao-forte"
              >
                <Edit3 className="h-4 w-4" />
                <span>Todas as tags</span>
              </button>
            )}
          </>
        }
      />

      {aviso && (
        <div className="flex items-center gap-2 rounded-[12px] border border-ok/30 bg-ok-suave px-4 py-3 text-sm font-medium text-ok">
          <Check className="h-4 w-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {marcas.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {marcas.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelecionada(m)}
              className={`rounded-[10px] border px-4 py-2 text-sm font-semibold transition ${
                selecionada?.id === m.id
                  ? "border-acao bg-acao text-acao-texto"
                  : "border-linha bg-superficie text-tinta-2 hover:text-tinta"
              }`}
            >
              {m.nome}
            </button>
          ))}
        </div>
      )}

      {/* Grade limpa das 5 lojas de afiliado */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lojas.map((l) => {
          const ativa = Boolean(l.valor);
          return (
            <article key={l.id} className="caixa caixa-viva flex flex-col justify-between overflow-hidden">
              {/* Faixa oficial com a logo real da loja */}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ backgroundColor: l.cor }}
              >
                <span
                  className={`inline-flex items-center ${
                    l.pillClaro ? "rounded-md bg-white px-2.5 py-1" : ""
                  }`}
                >
                  <img
                    src={l.logo}
                    alt={l.nome}
                    className="h-6 w-auto max-w-[125px] object-contain"
                  />
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                    ativa ? "bg-white/95 text-[#15803d]" : "bg-white/90 text-[#4B5563]"
                  }`}
                >
                  {ativa ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Conectada</span>
                    </>
                  ) : (
                    <>
                      <Circle className="h-3 w-3" />
                      <span>Sem tag</span>
                    </>
                  )}
                </span>
              </div>

              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <h2 className="font-display text-sm font-bold text-tinta">{l.nome}</h2>
                  <div className="mt-3 rounded-[9px] border border-linha bg-fundo px-3 py-2.5 font-mono text-xs text-tinta">
                    {ativa ? l.valor : "Link sai direto pro produto (sem comissão)"}
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-tinta-3">{l.onde}</p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-linha pt-3">
                  <a
                    href={l.portal}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-tinta-2 hover:text-tinta"
                  >
                    <span>Abrir portal</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setLojaFocada(l.id);
                      setLinkColado("");
                      setMsgExtracao(null);
                      setGavetaEditar(true);
                    }}
                    className="text-xs font-semibold text-fogo hover:underline"
                  >
                    {ativa ? "Alterar tag" : "Conectar agora"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {/* Editor Completo de Modelo de Mensagem de Oferta (com TODAS as variaveis + Preview WhatsApp) */}
      {selecionada && (
        <EditorMensagemOferta
          key={selecionada.id}
          marcaId={selecionada.id}
          marcaNome={selecionada.nome}
          templateInicial={selecionada.template_mensagem}
          onSalvo={(novo) => {
            setSelecionada({ ...selecionada, template_mensagem: novo });
            setAviso("Modelo de mensagem salvo — já vale para os próximos disparos!");
          }}
        />
      )}

      {/* Testador de link ao vivo */}
      <section className="caixa p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-tinta">Testador de link ao vivo</h2>
            <p className="text-xs text-tinta-3">
              Cole qualquer link de produto para conferir exatamente o link que vai sair nos seus grupos.
            </p>
          </div>
        </div>

        <form onSubmit={testarLink} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <input
            value={urlTeste}
            onChange={(e) => setUrlTeste(e.target.value)}
            placeholder="https://www.amazon.com.br/dp/..."
            className="campo flex-1"
          />
          <button
            type="submit"
            disabled={testando || !urlTeste.trim()}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-acao px-5 text-sm font-semibold text-acao-texto transition hover:bg-acao-forte disabled:opacity-50"
          >
            <Link2 className="h-4 w-4" />
            <span>{testando ? "Convertendo..." : "Testar link"}</span>
          </button>
        </form>

        {resultadoTeste && (
          <div className="mt-4 rounded-[10px] border border-linha bg-fundo p-3.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-tinta">
                Link final ({resultadoTeste.loja})
              </span>
              <span className={`selo ${resultadoTeste.convertido ? "selo-ok" : "selo-alerta"}`}>
                {resultadoTeste.convertido
                  ? "Sua tag aplicada"
                  : "Link direto (conecte a tag desta loja)"}
              </span>
            </div>
            <p className="mt-2 break-all font-mono text-[11px] text-tinta-2">
              {resultadoTeste.url_afiliado}
            </p>
          </div>
        )}
      </section>

      {/* Gaveta: Editar tag da loja selecionada (ou todas) */}
      <Gaveta
        aberta={gavetaEditar}
        onFechar={() => setGavetaEditar(false)}
        titulo={
          lojaFocada === "todas"
            ? "Conectar suas tags de afiliado"
            : `Conectar ${lojas.find((x) => x.id === lojaFocada)?.nome || "loja"}`
        }
        subtitulo={
          lojaFocada === "todas"
            ? "Deixe em branco as lojas que você ainda não usa — o sistema nunca inventa tag."
            : lojas.find((x) => x.id === lojaFocada)?.onde || "Informe sua tag oficial de afiliado."
        }
      >
        {selecionada && (
          <form onSubmit={salvar} className="space-y-4">
            {/* Guia passo a passo + Extrator automático de link da loja focada */}
            {lojaFocada !== "todas" && GUIAS_LOJAS[lojaFocada] && (
              <div className="space-y-3 rounded-[12px] border border-linha bg-fundo/70 p-4">
                {GUIAS_LOJAS[lojaFocada].alerta && (
                  <p className="rounded-[8px] border border-fogo/30 bg-fogo-suave px-3 py-2 text-xs font-semibold text-fogo">
                    {GUIAS_LOJAS[lojaFocada].alerta}
                  </p>
                )}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-tinta">
                    Como pegar seu código em 3 passos
                  </p>
                  <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-tinta-2">
                    {GUIAS_LOJAS[lojaFocada].passos.map((passo, idx) => (
                      <li key={idx}>
                        <strong className="text-tinta">{idx + 1}.</strong> {passo}
                      </li>
                    ))}
                  </ol>
                </div>
                <a
                  href={GUIAS_LOJAS[lojaFocada].portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-[8px] border border-linha-forte bg-superficie px-3 py-1.5 text-xs font-semibold text-tinta hover:bg-rebaixo"
                >
                  <span>{GUIAS_LOJAS[lojaFocada].portalLabel}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                <div className="border-t border-linha pt-3">
                  <label className="mb-1 block text-xs font-semibold text-tinta">
                    Não sabe o código? Cole aqui um link que você gerou lá:
                  </label>
                  <input
                    value={linkColado}
                    onChange={(e) => extrairTagDoLink(e.target.value)}
                    placeholder={GUIAS_LOJAS[lojaFocada].exemploLink}
                    className="campo font-mono text-xs"
                  />
                  {msgExtracao && (
                    <p
                      className={`mt-1.5 text-xs font-medium ${
                        msgExtracao.tipo === "ok" ? "text-ok" : "text-fogo"
                      }`}
                    >
                      {msgExtracao.texto}
                    </p>
                  )}
                </div>
              </div>
            )}

            {(lojaFocada === "todas" || lojaFocada === "amazon") && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-tinta-2">
                  Amazon (tag de associado)
                </label>
                <input
                  value={isTagReal(selecionada.amazon_tag) ? selecionada.amazon_tag : ""}
                  onChange={(e) => setSelecionada({ ...selecionada, amazon_tag: e.target.value })}
                  placeholder="ex: meucanal-20"
                  className="campo font-mono"
                />
              </div>
            )}
            {(lojaFocada === "todas" || lojaFocada === "mercadolivre") && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-tinta-2">
                  Mercado Livre (matt_word:matt_tool)
                </label>
                <input
                  value={isTagReal(selecionada.mercadolivre_tag) ? selecionada.mercadolivre_tag : ""}
                  onChange={(e) =>
                    setSelecionada({ ...selecionada, mercadolivre_tag: e.target.value })
                  }
                  placeholder="seuusuario:12345678 (ou cole o link do ML)"
                  className="campo font-mono"
                />
              </div>
            )}
            {(lojaFocada === "todas" || lojaFocada === "shopee") && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-tinta-2">
                  Shopee (Affiliate ID)
                </label>
                <input
                  value={isTagReal(selecionada.shopee_id) ? selecionada.shopee_id : ""}
                  onChange={(e) => setSelecionada({ ...selecionada, shopee_id: e.target.value })}
                  placeholder="ex: 18392010293"
                  className="campo font-mono"
                />
                <ShopeeApiCard />
              </div>
            )}
            {(lojaFocada === "todas" || lojaFocada === "aliexpress") && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-tinta-2">
                  AliExpress (aff_short_key)
                </label>
                <input
                  value={isTagReal(selecionada.aliexpress_id) ? selecionada.aliexpress_id : ""}
                  onChange={(e) => setSelecionada({ ...selecionada, aliexpress_id: e.target.value })}
                  placeholder="ex: _Dm9x1A"
                  className="campo font-mono"
                />
              </div>
            )}
            {(lojaFocada === "todas" || lojaFocada === "awin") && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-tinta-2">
                  Awin (Publisher ID)
                </label>
                <input
                  value={isTagReal(selecionada.awin_id) ? selecionada.awin_id : ""}
                  onChange={(e) => setSelecionada({ ...selecionada, awin_id: e.target.value })}
                  placeholder="ex: 1459201"
                  className="campo font-mono"
                />
              </div>
            )}
            {lojaFocada === "todas" && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-tinta-2">
                  Template da mensagem de disparo
                </label>
                <textarea
                  rows={4}
                  value={selecionada.template_mensagem}
                  onChange={(e) =>
                    setSelecionada({ ...selecionada, template_mensagem: e.target.value })
                  }
                  className="campo font-mono text-xs"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={salvando}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-acao text-sm font-semibold text-acao-texto transition hover:bg-acao-forte disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{salvando ? "Salvando..." : "Salvar"}</span>
            </button>
          </form>
        )}
      </Gaveta>

      {/* Gaveta: Logo e @ */}
      <Gaveta
        aberta={gavetaIdentidade}
        onFechar={() => setGavetaIdentidade(false)}
        titulo="Sua Logo e @"
        subtitulo="Aparece na vitrine publica, cards 9:16 e artes de cupom."
      >
        <IdentidadeMarcaCard />
      </Gaveta>

      {/* Gaveta: Nova marca */}
      <Gaveta
        aberta={gavetaNova}
        onFechar={() => setGavetaNova(false)}
        titulo="Nova marca"
        subtitulo="Crie outra operacao com tags e template separados."
      >
        <form onSubmit={criarMarca} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-tinta-2">Nome da marca</label>
            <input
              required
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex: Achados Casa"
              className="campo"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-acao text-sm font-semibold text-acao-texto transition hover:bg-acao-forte"
          >
            <Plus className="h-4 w-4" />
            <span>Criar marca</span>
          </button>
        </form>
      </Gaveta>
    </div>
  );
}

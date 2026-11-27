import Link from "next/link";
import { getConfigOperacao, getDb, type Conexao, type Fonte, type Marca, type Oferta } from "@/lib/db";
import { getDbV3, type CrmContato } from "@/lib/db-v3";
import { getDbV4 } from "@/lib/db-v4";
import { formatarMoeda, NOMES_LOJAS, tagValida, type LojaDetectada } from "@/lib/afiliado";
import { PageHeader } from "@/components/ui/page-header";
import { BotaoGarimpar } from "@/components/inicio-acoes";
import { HeroDecisoes, type DecisaoHero } from "@/components/hero-decisoes";
import {
  Activity,
  ArrowRight,
  ExternalLink,
  MousePointerClick,
  Radio,
  Tag,
} from "lucide-react";

export const dynamic = "force-dynamic";

const ESTILO_SEM_FOTO: Record<string, { bg: string; logo: string; pillClaro: boolean }> = {
  mercadolivre: { bg: "#FFE600", logo: "/logos/mercadolivre-oficial.png", pillClaro: false },
  amazon: { bg: "#131921", logo: "/logos/amazon.svg", pillClaro: true },
  shopee: { bg: "#EE4D2D", logo: "/logos/shopee.svg", pillClaro: true },
  aliexpress: { bg: "#E62E04", logo: "/logos/aliexpress.svg", pillClaro: true },
  awin: { bg: "#0086FF", logo: "/logos/magalu.png", pillClaro: false },
  outra: { bg: "#181614", logo: "", pillClaro: false },
};

async function checarWhatsAppBaileysConectado(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 500);
    const r = await fetch("http://127.0.0.1:4320/status", {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!r.ok) return false;
    const st = (await r.json()) as { estado?: string };
    return st.estado === "conectado";
  } catch {
    return false;
  }
}

function tempoRelativo(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `há ${diffD}d`;
}

export default async function InicioPage() {
  const db = getDb();
  const dbV3 = getDbV3();
  const dbV4 = getDbV4();
  const config = getConfigOperacao();

  const ofertas = db
    .prepare(
      "SELECT * FROM ofertas WHERE exemplo = 0 AND status != 'descartada' ORDER BY criado_em DESC LIMIT 100"
    )
    .all() as unknown as Oferta[];
  const fontes = db.prepare("SELECT * FROM fontes").all() as unknown as Fonte[];
  const marcas = db.prepare("SELECT * FROM marcas").all() as unknown as Marca[];
  const conexoes = db
    .prepare("SELECT * FROM conexoes WHERE ativa = 1")
    .all() as unknown as Conexao[];

  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const inicioHojeIso = inicioHoje.toISOString();

  const enviosHoje = (
    db
      .prepare(
        "SELECT COUNT(*) as total FROM envios WHERE status IN ('enviado', 'simulado') AND criado_em >= ?"
      )
      .get(inicioHojeIso) as { total: number }
  ).total;

  const novas = ofertas.filter((o) => o.status === "nova").length;
  const naFila = ofertas.filter((o) => o.status === "aprovada").length;
  const totalCliques = ofertas.reduce((acc, o) => acc + (o.cliques || 0), 0);
  const fontesAtivas = fontes.filter((f) => f.ativa === 1).length;

  // Pedidos VIP com oferta compatível
  const contatos = dbV3
    .prepare("SELECT * FROM crm_contatos WHERE status != 'converteu'")
    .all() as unknown as CrmContato[];
  const desejosMatch = contatos.filter((c) => {
    const t = c.desejo_produto.trim().toLowerCase();
    if (!t) return false;
    return ofertas.some(
      (o) =>
        o.titulo.toLowerCase().includes(t) &&
        (c.desejo_preco_max <= 0 || (o.preco > 0 && o.preco <= c.desejo_preco_max))
    );
  }).length;

  // Monitores de preço que atingiram alvo
  const monitoresAtingidos = (
    dbV4
      .prepare("SELECT COUNT(*) as total FROM monitores_preco WHERE status = 'alvo_atingido'")
      .get() as { total: number }
  ).total;

  const marcaPrincipal = marcas[0];
  const temTagReal = Boolean(
    marcaPrincipal &&
      (tagValida(marcaPrincipal.amazon_tag) ||
        tagValida(marcaPrincipal.shopee_id) ||
        tagValida(marcaPrincipal.mercadolivre_tag) ||
        tagValida(marcaPrincipal.aliexpress_id) ||
        tagValida(marcaPrincipal.awin_id))
  );

  // Mesma fonte de verdade usada no menu lateral
  const waBaileysAtivo = await checarWhatsAppBaileysConectado();
  const telegramAtivo = conexoes.some((c) => c.tipo === "telegram" && Boolean(c.token));
  const whatsappConexaoAtiva = conexoes.some(
    (c) =>
      (c.tipo === "whatsapp_evolution" ||
        c.tipo === "whatsapp_zapi" ||
        c.tipo === "whatsapp_baileys") &&
      Boolean(c.endpoint || c.destino)
  );
  const canalEnvioConectado = waBaileysAtivo || whatsappConexaoAtiva || telegramAtivo;
  const modoProducao = !config.modo_teste;

  // Fila de decisões reais em ordem de prioridade (1 a 5)
  const decisoes: DecisaoHero[] = [];

  if (modoProducao && !temTagReal) {
    decisoes.push({
      id: "sem-tag",
      etiqueta: "Atenção",
      contexto: "Contas de Afiliado",
      titulo: "Seus disparos estão saindo sem tag de afiliado.",
      descricao:
        "A operação está em modo produção, mas nenhuma loja tem tag conectada. Conecte Amazon, Mercado Livre ou Shopee para comissionar cada clique.",
      ctaLabel: "Conectar contas",
      ctaHref: "/marcas",
    });
  }

  if (modoProducao && !canalEnvioConectado) {
    decisoes.push({
      id: "sem-canal",
      etiqueta: "Canal offline",
      contexto: "Conexões",
      titulo: "Conecte um canal de envio para disparar nos seus grupos.",
      descricao:
        "Nenhum WhatsApp ou Telegram está ativo no momento. Pareie o QR Code em Conexões para liberar os disparos automáticos.",
      ctaLabel: "Conectar agora",
      ctaHref: "/conexoes",
    });
  }

  if (novas > 0) {
    decisoes.push({
      id: "ofertas-novas",
      etiqueta: "Aberta",
      contexto: "Catálogo de ofertas",
      titulo: `Revisar ${novas} ${novas === 1 ? "oferta nova" : "ofertas novas"} esperando no catálogo.`,
      descricao:
        naFila > 0
          ? `Você já tem ${naFila} na fila pronta para sair. Escolha as melhores ofertas novas para abastecer seus grupos hoje.`
          : "As ofertas chegaram das suas fontes e grupos espelhados. Aprove as melhores para mandar pra Esteira.",
      ctaLabel: "Revisar agora",
      ctaHref: "/ofertas",
      secundarioLabel: "Abrir Esteira",
      secundarioHref: "/fila",
    });
  }

  if (desejosMatch > 0) {
    decisoes.push({
      id: "pedidos-vip",
      etiqueta: "Pedidos VIP",
      contexto: "Encomendas no WhatsApp",
      titulo: `Avisar ${desejosMatch} ${desejosMatch === 1 ? "cliente VIP" : "clientes VIP"} com oferta pronta.`,
      descricao:
        "Seguidores que pediram produto no privado já têm oferta compatível no catálogo. Mande direto no WhatsApp com seu link.",
      ctaLabel: "Ver pedidos VIP",
      ctaHref: "/crm",
    });
  }

  if (monitoresAtingidos > 0) {
    decisoes.push({
      id: "monitor-alvo",
      etiqueta: "Preço-alvo",
      contexto: "Monitor de Preço",
      titulo: `${monitoresAtingidos} ${monitoresAtingidos === 1 ? "produto atingiu" : "produtos atingiram"} o preço-alvo.`,
      descricao:
        "O Monitor de Preço detectou queda abaixo do limite definido. Abra o monitor para transformar em oferta e disparar.",
      ctaLabel: "Abrir Monitor",
      ctaHref: "/monitor",
    });
  }

  if (decisoes.length === 0) {
    decisoes.push({
      id: "resumo-dia",
      etiqueta: modoProducao ? "Em produção" : "Simulação",
      contexto: `Janela ${config.horario_inicio}–${config.horario_fim}`,
      titulo: "Operação em dia hoje no pega-oferta.",
      descricao: `${fontesAtivas} fontes ativas monitorando promoções e ${enviosHoje} disparos realizados até agora.`,
      ctaLabel: "Abrir Esteira",
      ctaHref: "/fila",
      secundarioLabel: "Ver Ofertas",
      secundarioHref: "/ofertas",
    });
  }

  // Subtítulo vivo gerado dos dados reais
  const partesSub: string[] = [];
  if (novas > 0) {
    partesSub.push(`${novas} ${novas === 1 ? "oferta esperando revisão" : "ofertas esperando revisão"}`);
  }
  if (naFila > 0) {
    partesSub.push(`${naFila} na fila`);
  }
  const subtituloVivo =
    partesSub.length > 0
      ? `${partesSub.join(" e ")}.`
      : `${fontesAtivas} fontes ativas operando na janela ${config.horario_inicio}–${config.horario_fim}.`;

  // 4 cards de "Seu fluxo hoje" (cada número aparece uma única vez na tela)
  const fluxoHoje = [
    {
      label: "Fontes ativas",
      valor: fontesAtivas,
      legenda: "sites e grupos conectados",
      href: "/fontes",
      icon: Radio,
      bg: "var(--sec-fontes-bg)",
      fg: "var(--sec-fontes-fg)",
    },
    {
      label: "Novas no catálogo",
      valor: novas,
      legenda: "aguardando revisão",
      href: "/ofertas",
      icon: Tag,
      bg: "var(--sec-ofertas-bg)",
      fg: "var(--sec-ofertas-fg)",
    },
    {
      label: "Na fila",
      valor: naFila,
      legenda: "prontas na esteira",
      href: "/fila",
      icon: Activity,
      bg: "var(--sec-esteira-bg)",
      fg: "var(--sec-esteira-fg)",
    },
    {
      label: "Cliques",
      valor: totalCliques,
      legenda: "nos links das ofertas",
      href: "/vitrine",
      icon: MousePointerClick,
      bg: "var(--sec-grupos-bg)",
      fg: "var(--sec-grupos-fg)",
    },
  ];

  const ultimasOfertas = ofertas.slice(0, 8);

  return (
    <div className="space-y-9 pb-10">
      {/* Cabeçalho editorial */}
      <PageHeader
        sobrelinha="INÍCIO"
        titulo="Hoje no pega-oferta"
        subtitulo={subtituloVivo}
        acoes={
          <>
            <Link
              href="/vitrine"
              target="_blank"
              className="btn-secundario"
            >
              <span>Vitrine pública</span>
              <ExternalLink className="h-4 w-4" />
            </Link>
            <BotaoGarimpar />
          </>
        }
      />

      {/* HERO "decisão da vez" com gradiente laranja + robô grande */}
      <HeroDecisoes
        decisoes={decisoes}
        enviosHoje={enviosHoje}
        limiteDiario={config.limite_diario}
      />

      {/* Seu fluxo hoje: 4 cards clicáveis com quadradinho colorido */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-[19px] font-extrabold text-tinta">
            Seu fluxo hoje
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {fluxoHoje.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="caixa caixa-viva group flex flex-col justify-between p-5"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-[11px]"
                    style={{ backgroundColor: item.bg, color: item.fg }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-tinta-3 transition group-hover:translate-x-0.5 group-hover:text-fogo" />
                </div>

                <div className="mt-5">
                  <p className="num display text-[34px] font-extrabold leading-none text-tinta">
                    {item.valor}
                  </p>
                  <p className="mt-2 text-sm font-bold text-tinta">{item.label}</p>
                  <p className="mt-0.5 text-xs text-tinta-3">{item.legenda}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Últimas ofertas: cards com FOTO grande, 4 por linha no desktop */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-[19px] font-extrabold text-tinta">
            Últimas ofertas
          </h2>
          <Link
            href="/ofertas"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-fogo hover:underline"
          >
            <span>Ver todas</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {ultimasOfertas.length === 0 ? (
          <div className="caixa p-10 text-center">
            <p className="text-sm font-semibold text-tinta">Nenhuma oferta captada ainda</p>
            <p className="mt-1 text-xs text-tinta-3">
              Clique em &ldquo;Garimpar agora&rdquo; no topo ou ative um grupo em Fontes &amp; Espelho.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ultimasOfertas.map((o) => {
              const lojaNome =
                NOMES_LOJAS[(o.loja as LojaDetectada) || "outra"] || o.loja || "Loja";
              const fallback = ESTILO_SEM_FOTO[o.loja] || ESTILO_SEM_FOTO.outra;
              const tempo = tempoRelativo(o.criado_em);

              return (
                <Link
                  key={o.id}
                  href="/ofertas"
                  className="caixa caixa-viva group flex flex-col overflow-hidden"
                >
                  {/* Foto grande do produto ou fundo na cor da loja + logo */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-rebaixo">
                    {o.imagem_url ? (
                      <img
                        src={o.imagem_url}
                        alt={o.titulo}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div
                        className="grid h-full w-full place-items-center p-6"
                        style={{ backgroundColor: fallback.bg }}
                      >
                        {fallback.logo ? (
                          <span
                            className={`inline-flex items-center ${
                              fallback.pillClaro ? "rounded-xl bg-white px-3.5 py-2" : ""
                            }`}
                          >
                            <img
                              src={fallback.logo}
                              alt={lojaNome}
                              className="max-h-10 w-auto object-contain"
                            />
                          </span>
                        ) : (
                          <span className="display text-lg font-extrabold text-white">
                            {lojaNome}
                          </span>
                        )}
                      </div>
                    )}

                    {o.desconto_pct && o.desconto_pct > 0 ? (
                      <span className="num absolute right-3 top-3 rounded-full bg-[#15803d] px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                        -{o.desconto_pct}%
                      </span>
                    ) : null}
                  </div>

                  {/* Corpo do card */}
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <p className="text-[11.5px] font-medium text-tinta-3">
                        <span className="font-semibold text-tinta-2">{lojaNome}</span>
                        {tempo ? ` · ${tempo}` : ""}
                      </p>
                      <h3 className="mt-1.5 line-clamp-2 text-[14px] font-bold leading-snug text-tinta group-hover:text-fogo">
                        {o.titulo}
                      </h3>
                    </div>

                    <div className="mt-4 pt-2">
                      {o.preco_antigo && o.preco_antigo > o.preco && (
                        <p className="num text-xs text-tinta-3 line-through">
                          {formatarMoeda(o.preco_antigo)}
                        </p>
                      )}
                      <p className="num text-[18px] font-extrabold tracking-tight text-tinta">
                        {o.preco > 0 ? formatarMoeda(o.preco) : "Ver oferta"}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

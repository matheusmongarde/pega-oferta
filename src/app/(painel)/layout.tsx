import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { getConfigOperacao, getDb, type Conexao, type Fonte, type Marca, type Oferta } from "@/lib/db";
import { tagValida } from "@/lib/afiliado";
import { getDbV3, type CrmContato } from "@/lib/db-v3";
import { getDbV4 } from "@/lib/db-v4";
import { estaInstalado, usuarioAtual } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sem conta criada ainda: primeiro instala (cria conta, WhatsApp, tags, fontes)
  if (!estaInstalado()) {
    redirect("/instalar");
  }
  if (!(await usuarioAtual())) {
    redirect("/entrar");
  }
  const db = getDb();
  const dbV3 = getDbV3();
  const dbV4 = getDbV4();
  const monitoresAtingidos = (dbV4.prepare("SELECT COUNT(*) as total FROM monitores_preco WHERE status = 'alvo_atingido'").get() as { total: number }).total;
  const config = getConfigOperacao();

  const pendentes = (
    db
      .prepare("SELECT COUNT(*) as total FROM ofertas WHERE status IN ('nova', 'aprovada') AND exemplo = 0")
      .get() as { total: number }
  ).total;

  const conexoes = db
    .prepare("SELECT * FROM conexoes WHERE ativa = 1")
    .all() as unknown as Conexao[];

  const fontesAtivas = (
    db.prepare("SELECT * FROM fontes WHERE ativa = 1").all() as unknown as Fonte[]
  ).length;

  const ofertasAtivas = db
    .prepare("SELECT * FROM ofertas WHERE status IN ('nova', 'aprovada', 'enviada') LIMIT 100")
    .all() as unknown as Oferta[];

  const contatos = dbV3
    .prepare("SELECT * FROM crm_contatos WHERE status != 'converteu'")
    .all() as unknown as CrmContato[];

  const desejosMatch = contatos.filter((c) => {
    const t = c.desejo_produto.trim().toLowerCase();
    if (!t) return false;
    return ofertasAtivas.some(
      (o) =>
        o.titulo.toLowerCase().includes(t) &&
        (c.desejo_preco_max <= 0 || (o.preco > 0 && o.preco <= c.desejo_preco_max))
    );
  }).length;

  let waBaileysAtivo = false;
  let waNumero: string | null = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 500);
    const r = await fetch("http://127.0.0.1:4320/status", { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    if (r.ok) {
      const st = (await r.json()) as { estado?: string; numero?: string | null };
      waBaileysAtivo = st.estado === "conectado";
      waNumero = st.numero || null;
    }
  } catch {
    /* offline */
  }

  const marcaPrincipal = db
    .prepare("SELECT * FROM marcas ORDER BY criado_em ASC LIMIT 1")
    .get() as unknown as Marca | undefined;
  const temTagReal = Boolean(
    marcaPrincipal &&
      (tagValida(marcaPrincipal.amazon_tag) ||
        tagValida(marcaPrincipal.shopee_id) ||
        tagValida(marcaPrincipal.mercadolivre_tag) ||
        tagValida(marcaPrincipal.aliexpress_id) ||
        tagValida(marcaPrincipal.awin_id))
  );

  const status = {
    telegram: conexoes.some((c) => c.tipo === "telegram" && Boolean(c.token)),
    whatsapp: waBaileysAtivo || conexoes.some(
      (c) =>
        (c.tipo === "whatsapp_evolution" ||
          c.tipo === "whatsapp_zapi" ||
          c.tipo === "whatsapp_baileys") &&
        Boolean(c.endpoint || c.destino)
    ),
    fontes: fontesAtivas > 0,
    vitrine: ofertasAtivas.some((o) => o.status === "aprovada" || o.status === "enviada"),
  };

  return (
    <div className="min-h-[100svh]">
      <Sidebar
        ofertasPendentes={pendentes}
        status={status}
        modoTeste={config.modo_teste}
        temTagReal={temTagReal}
        waNumero={waNumero}
        nomeOperacao={config.nome_vitrine}
        desejosMatch={desejosMatch}
        monitoresAtingidos={monitoresAtingidos}
        arrobaMarca={config.arroba_marca}
        logoUrl={config.logo_data_url}
      />
      <div className="conteudo-painel">
        <main className="pagina-entra mx-auto w-full max-w-[1200px] px-4 pb-20 pt-7 sm:px-10 sm:pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
import Link from "next/link";
import { getConfigOperacao, getDb, type Oferta } from "@/lib/db";
import { getDbV3, isMenorPrecoHistorico, type Cupom } from "@/lib/db-v3";
import { formatarMoeda, NOMES_LOJAS, type LojaDetectada } from "@/lib/afiliado";
import { VitrineCupons } from "@/components/vitrine-cupons";
import { ArrowUpRight, Flame, Tag, TrendingDown } from "lucide-react";

export const dynamic = "force-dynamic";

export default function VitrinePage() {
  const db = getDb();
  const dbV3 = getDbV3();
  const config = getConfigOperacao();

  const ofertas = db
    .prepare(
      "SELECT * FROM ofertas WHERE status = 'enviada' AND exemplo = 0 ORDER BY criado_em DESC LIMIT 60"
    )
    .all() as unknown as Oferta[];

  const cuponsAtivos = dbV3
    .prepare("SELECT * FROM cupons WHERE status IN ('ativo', 'acabando') ORDER BY criado_em DESC LIMIT 8")
    .all() as unknown as Cupom[];

  return (
    <div className="min-h-screen bg-fundo text-tinta">
      <header className="border-b border-linha bg-superficie">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            {config.logo_data_url ? (
              <img
                src={config.logo_data_url}
                alt={config.nome_vitrine}
                className="h-10 w-10 rounded-[11px] border border-linha object-cover"
              />
            ) : (
              <span className="glow-fogo flex h-10 w-10 items-center justify-center rounded-[11px] bg-acao text-acao-texto">
                <Flame className="h-5 w-5" />
              </span>
            )}
            <div>
              <span className="font-display text-lg font-bold tracking-tight text-tinta">
                {config.nome_vitrine}
              </span>
              <span className="block font-mono text-xs text-tinta-3">
                {config.arroba_marca || "@pegaoferta"}
              </span>
            </div>
          </div>

          <Link
            href="/"
            className="rounded-[10px] border border-linha-forte bg-superficie px-3.5 py-2 text-xs font-semibold text-tinta-2 transition hover:border-fogo hover:text-tinta"
          >
            Painel admin
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <p className="sobrelinha mb-2">OFERTAS VERIFICADAS · {config.arroba_marca || "@pegaoferta"}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {config.nome_vitrine}
            <span className="text-fogo">.</span>
          </h1>
          <p className="mt-1.5 text-[15px] text-tinta-2">{config.subtitulo_vitrine}</p>
        </div>

        <VitrineCupons cuponsIniciais={cuponsAtivos.map((c) => ({ ...c }))} />

        {ofertas.length === 0 ? (
          <div className="caixa p-12 text-center">
            <Tag className="mx-auto h-8 w-8 text-fogo" />
            <p className="mt-3 text-[15px] font-semibold">Nenhuma oferta publicada ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ofertas.map((o) => {
              const menorPreco = isMenorPrecoHistorico(o.hash_dedup, o.preco);
              return (
                <article
                  key={o.id}
                  className="caixa caixa-viva flex flex-col overflow-hidden"
                >
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
                        {NOMES_LOJAS[(o.loja as LojaDetectada) || "outra"] || o.loja}
                      </span>
                      {o.desconto_pct && (
                        <span className="rounded-full bg-fogo px-2.5 py-0.5 font-mono text-[11px] font-bold text-white">
                          -{o.desconto_pct}%
                        </span>
                      )}
                    </div>
                    {menorPreco && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-ok px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        <TrendingDown className="h-3 w-3" />
                        Menor preco
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <h2 className="line-clamp-2 min-h-[44px] text-[15px] font-semibold leading-snug text-tinta">
                        {o.titulo}
                      </h2>

                      {o.cupom && (
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-[8px] border border-dashed border-linha-forte bg-rebaixo px-2.5 py-1 font-mono text-xs text-tinta">
                          <span className="text-tinta-3">Cupom:</span>
                          <span className="font-semibold">{o.cupom}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-2 border-t border-linha pt-4">
                      <div>
                        {o.preco_antigo && (
                          <span className="block font-mono text-xs text-tinta-3 line-through">
                            {formatarMoeda(o.preco_antigo)}
                          </span>
                        )}
                        <span className="font-display text-2xl font-bold text-tinta">
                          {o.preco > 0 ? formatarMoeda(o.preco) : "Ver preco"}
                        </span>
                      </div>

                      <a
                        href={`/ir/${o.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="glow-fogo inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-acao px-4 text-sm font-semibold text-acao-texto transition hover:bg-acao-forte"
                      >
                        <span>Pegar</span>
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
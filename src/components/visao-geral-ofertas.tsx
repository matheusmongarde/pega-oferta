"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

export interface OfertaResumoItem {
  id: string;
  titulo: string;
  loja: string;
  lojaNome: string;
  fonte: string;
  preco: number;
  precoAntigo: number | null;
  descontoPct: number | null;
  imagemUrl: string;
  status: "nova" | "aprovada" | "enviada" | "descartada";
  criadoEm: string;
}

const LOGOS_LOJA: Record<string, string> = {
  mercadolivre: "/logos/mercadolivre-oficial.png",
  amazon: "/logos/amazon.svg",
  shopee: "/logos/shopee.svg",
  aliexpress: "/logos/aliexpress.svg",
  awin: "/logos/magalu.png",
};

function formatarPreco(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
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

export function VisaoGeralOfertas({ itensIniciais }: { itensIniciais: OfertaResumoItem[] }) {
  const router = useRouter();
  const [itens, setItens] = useState<OfertaResumoItem[]>(itensIniciais);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

  async function atualizarStatus(id: string, novoStatus: "aprovada" | "descartada") {
    setOcupadoId(id);
    try {
      const res = await fetch(`/api/ofertas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (res.ok) {
        if (novoStatus === "descartada") {
          setItens((prev) => prev.filter((x) => x.id !== id));
        } else {
          setItens((prev) =>
            prev.map((x) => (x.id === id ? { ...x, status: novoStatus } : x))
          );
        }
        router.refresh();
      }
    } finally {
      setOcupadoId(null);
    }
  }

  return (
    <section className="mx-auto w-full max-w-[860px]">
      <h2 className="mb-6 text-center text-lg font-bold tracking-tight text-tinta">
        Últimas ofertas
      </h2>

      {itens.length === 0 ? (
        <div className="border-y border-linha py-12 text-center">
          <p className="text-sm font-semibold text-tinta">Nenhuma oferta captada ainda</p>
          <p className="mt-1 text-xs text-tinta-3">
            Clique em &ldquo;Garimpar agora&rdquo; acima ou ative um grupo em Fontes &amp; Espelho.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-linha border-y border-linha">
          {itens.map((o) => {
            const logoFallback = LOGOS_LOJA[o.loja] || "";
            const tempo = tempoRelativo(o.criadoEm);
            const statusLabel =
              o.status === "enviada"
                ? "Enviada"
                : o.status === "aprovada"
                ? "Na fila"
                : "Nova";
            const statusCor =
              o.status === "enviada"
                ? "text-ok"
                : o.status === "aprovada"
                ? "text-fogo"
                : "text-tinta-3";

            return (
              <div
                key={o.id}
                className="group flex flex-col gap-3 py-4 transition sm:flex-row sm:items-center sm:justify-between sm:gap-5"
              >
                <Link
                  href="/fila"
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  {o.imagemUrl ? (
                    <img
                      src={o.imagemUrl}
                      alt={o.titulo}
                      className="h-14 w-14 shrink-0 rounded-[10px] border border-linha bg-superficie object-cover sm:h-16 sm:w-16"
                    />
                  ) : logoFallback ? (
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[10px] border border-linha bg-superficie p-2 sm:h-16 sm:w-16">
                      <img
                        src={logoFallback}
                        alt={o.lojaNome}
                        className="max-h-9 w-auto object-contain"
                      />
                    </div>
                  ) : (
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[10px] border border-linha bg-rebaixo px-1 text-center text-[10px] font-semibold leading-tight text-tinta-2 sm:h-16 sm:w-16">
                      {o.lojaNome}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-tinta group-hover:text-fogo">
                      {o.titulo}
                    </p>
                    <p className="mt-1 truncate text-xs text-tinta-3">
                      <span className="font-medium text-tinta-2">{o.lojaNome}</span>
                      {o.fonte ? ` · ${o.fonte}` : ""}
                      {tempo ? ` · ${tempo}` : ""}
                    </p>
                  </div>
                </Link>

                <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                  {/* Ações rápidas no hover (desktop) / sempre acessíveis no toque */}
                  {o.status === "nova" && (
                    <div className="flex items-center gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        type="button"
                        disabled={ocupadoId === o.id}
                        onClick={() => atualizarStatus(o.id, "aprovada")}
                        className="rounded-[8px] bg-fogo px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-fogo-forte disabled:opacity-50"
                      >
                        Mandar pra fila
                      </button>
                      <button
                        type="button"
                        disabled={ocupadoId === o.id}
                        onClick={() => atualizarStatus(o.id, "descartada")}
                        className="rounded-[8px] px-2 py-1 text-xs font-medium text-tinta-3 transition hover:bg-rebaixo hover:text-erro disabled:opacity-50"
                      >
                        Descartar
                      </button>
                    </div>
                  )}

                  <div className="text-right">
                    <div className="flex items-baseline justify-end gap-2">
                      {o.precoAntigo && o.precoAntigo > o.preco && (
                        <span className="num text-xs text-tinta-3 line-through">
                          {formatarPreco(o.precoAntigo)}
                        </span>
                      )}
                      {o.preco > 0 && (
                        <span className="num text-[15px] font-bold text-tinta">
                          {formatarPreco(o.preco)}
                        </span>
                      )}
                      {o.descontoPct && o.descontoPct > 0 ? (
                        <span className="num text-xs font-semibold text-ok">
                          -{o.descontoPct}%
                        </span>
                      ) : null}
                    </div>
                    <p className={`mt-0.5 text-[11px] font-semibold ${statusCor}`}>
                      {statusLabel}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 text-center">
        <Link
          href="/ofertas"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-tinta-2 transition hover:text-tinta"
        >
          <span>Ver todas</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

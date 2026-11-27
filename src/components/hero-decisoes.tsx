"use client";

import Link from "next/link";
import { useState } from "react";
import { AvatarLogo } from "@/components/ui/avatar-logo";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface DecisaoHero {
  id: string;
  etiqueta: string;
  contexto: string;
  titulo: string;
  descricao: string;
  ctaLabel: string;
  ctaHref: string;
  secundarioLabel?: string;
  secundarioHref?: string;
}

interface HeroDecisoesProps {
  decisoes: DecisaoHero[];
  enviosHoje: number;
  limiteDiario: number;
}

export function HeroDecisoes({
  decisoes,
  enviosHoje,
  limiteDiario,
}: HeroDecisoesProps) {
  const [indice, setIndice] = useState(0);
  const total = decisoes.length;
  const atual = decisoes[Math.min(indice, Math.max(0, total - 1))];

  const pct = Math.min(100, Math.round((enviosHoje / Math.max(1, limiteDiario)) * 100));
  const raio = 23;
  const circunferencia = 2 * Math.PI * raio;
  const offset = circunferencia - (pct / 100) * circunferencia;

  function anterior() {
    setIndice((i) => (i <= 0 ? total - 1 : i - 1));
  }

  function proximo() {
    setIndice((i) => (i >= total - 1 ? 0 : i + 1));
  }

  if (!atual) return null;

  return (
    <section className="hero-pega p-6 sm:p-8 lg:p-10">
      {/* Textura diagonal sutil sobre o gradiente */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, #ffffff 0 1px, transparent 1px 12px)",
        }}
      />

      {/* Robô GRANDE no lado direito (asset existente) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-7 right-4 hidden select-none opacity-95 md:block lg:right-10"
      >
        <AvatarLogo size={215} mood="happy" />
      </div>

      <div className="relative z-10 max-w-[640px]">
        {/* Linha superior: indicador circular + navegação 1 de N */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative grid h-14 w-14 shrink-0 place-items-center">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56" aria-hidden>
                <circle
                  cx="28"
                  cy="28"
                  r={raio}
                  fill="none"
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="4.5"
                />
                <circle
                  cx="28"
                  cy="28"
                  r={raio}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray={circunferencia}
                  strokeDashoffset={offset}
                />
              </svg>
              <span className="num absolute text-[12px] font-extrabold text-white">
                {enviosHoje}/{limiteDiario}
              </span>
            </div>
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/75">
                HOJE
              </p>
              <p className="num text-[13.5px] font-semibold text-white">
                {enviosHoje} de {limiteDiario} disparos feitos
              </p>
            </div>
          </div>

          {total > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={anterior}
                aria-label="Decisão anterior"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="num rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                {indice + 1} de {total}
              </span>
              <button
                type="button"
                onClick={proximo}
                aria-label="Próxima decisão"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Pílula de status + contexto */}
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-white backdrop-blur-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#fef08a]" />
            <span>{atual.etiqueta}</span>
          </span>
          <span className="text-xs font-medium text-white/85">{atual.contexto}</span>
        </div>

        {/* Título grande em branco */}
        <h2 className="display mt-3.5 text-[28px] font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:text-[36px]">
          {atual.titulo}
        </h2>

        {/* Descrição curta com dado real */}
        <p className="mt-3 max-w-[54ch] text-[14.5px] leading-relaxed text-white/88">
          {atual.descricao}
        </p>

        {/* Botões de ação */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={atual.ctaHref}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-white px-5 text-sm font-bold text-[#181614] shadow-sm transition hover:-translate-y-0.5 hover:bg-white/95"
          >
            {atual.ctaLabel}
          </Link>

          {atual.secundarioLabel && atual.secundarioHref && (
            <Link
              href={atual.secundarioHref}
              className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-white/30 bg-white/12 px-4 text-sm font-semibold text-white transition hover:bg-white/22"
            >
              {atual.secundarioLabel}
            </Link>
          )}

          {total > 1 && (
            <button
              type="button"
              onClick={proximo}
              className="inline-flex min-h-[44px] items-center justify-center px-3 text-sm font-semibold text-white/80 transition hover:text-white"
            >
              Depois
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

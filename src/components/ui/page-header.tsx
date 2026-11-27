import type { ReactNode } from "react";

interface PageHeaderProps {
  sobrelinha: string;
  titulo: string;
  subtitulo: string;
  acoes?: ReactNode;
}

export function PageHeader({
  sobrelinha,
  titulo,
  subtitulo,
  acoes,
}: PageHeaderProps) {
  const tituloLimpo = titulo.endsWith(".") ? titulo.slice(0, -1) : titulo;

  return (
    <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <span className="etiqueta-secao mb-3">{sobrelinha}</span>
        <h1 className="font-display text-[38px] font-extrabold leading-[1.02] tracking-[-0.035em] text-tinta sm:text-[48px]">
          {tituloLimpo}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-tinta-2">
          {subtitulo}
        </p>
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-3">{acoes}</div>}
    </header>
  );
}

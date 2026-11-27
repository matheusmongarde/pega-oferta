"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface GavetaProps {
  aberta: boolean;
  aoFechar?: () => void;
  onFechar?: () => void;
  sobrelinha?: string;
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}

export function Gaveta({
  aberta,
  aoFechar,
  onFechar,
  sobrelinha,
  titulo,
  subtitulo,
  children,
}: GavetaProps) {
  const fechar = aoFechar || onFechar || (() => {});

  useEffect(() => {
    if (!aberta) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [aberta, fechar]);

  if (!aberta) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar painel lateral"
        onClick={fechar}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <aside className="gaveta-entra relative z-10 flex h-full w-full max-w-[480px] flex-col border-l border-linha bg-superficie shadow-2xl">
        <div className="hachura flex items-start justify-between gap-4 border-b border-linha px-6 py-5">
          <div>
            {sobrelinha && <p className="sobrelinha mb-1">{sobrelinha}</p>}
            <h2 className="font-display text-xl font-bold text-tinta">{titulo}</h2>
            {subtitulo && <p className="mt-1 text-xs text-tinta-3">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-linha bg-superficie text-tinta-3 transition hover:border-tinta-3 hover:text-tinta"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </aside>
    </div>
  );
}
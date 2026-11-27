"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink } from "lucide-react";

export interface ItemPedagio {
  id: string;
  tag: string;
  titulo: string;
  texto: string;
  acao: string;
  link: string;
}

export function ListaPedagio({ itens }: { itens: ItemPedagio[] }) {
  const [pagos, setPagos] = useState<string[]>([]);

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem("pega-oferta:pedagio") || "[]") as string[];
      if (Array.isArray(salvo)) setPagos(salvo);
    } catch {
      /* sem storage */
    }
  }, []);

  function marcarPago(id: string) {
    setPagos((atual) => {
      if (atual.includes(id)) return atual;
      const proximo = [...atual, id];
      try {
        localStorage.setItem("pega-oferta:pedagio", JSON.stringify(proximo));
        window.dispatchEvent(new Event("pega-oferta:pedagio"));
      } catch {
        /* sem storage */
      }
      return proximo;
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-tinta-3">
          Checklist da cancela
        </span>
        <span className="num font-semibold text-tinta">
          {pagos.length}/{itens.length} pagos
        </span>
      </div>

      <div className="divide-y divide-linha overflow-hidden rounded-[16px] border border-linha bg-superficie">
        {itens.map((item) => {
          const pago = pagos.includes(item.id);
          return (
            <div
              key={item.id}
              className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] font-mono text-xs font-bold ${
                    pago
                      ? "bg-ok-suave text-ok"
                      : "border border-linha bg-rebaixo text-tinta-2"
                  }`}
                >
                  {pago ? <Check className="h-4 w-4" /> : item.tag}
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-tinta">{item.titulo}</p>
                  <p className="text-[13px] text-tinta-3">{item.texto}</p>
                </div>
              </div>

              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                onClick={() => marcarPago(item.id)}
                className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[10px] px-3.5 text-xs font-semibold transition ${
                  pago
                    ? "border border-linha bg-rebaixo text-tinta-2"
                    : "bg-acao text-acao-texto hover:bg-acao-forte"
                }`}
              >
                <span>{pago ? "Pago" : item.acao}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
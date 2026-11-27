"use client";

import { useState } from "react";
import { Check, Copy, Flag, Ticket } from "lucide-react";

interface CupomVitrine {
  id: string;
  codigo: string;
  loja: string;
  descricao: string;
  status: string;
  validade: string;
}

export function VitrineCupons({ cuponsIniciais }: { cuponsIniciais: CupomVitrine[] }) {
  const [cupons, setCupons] = useState(cuponsIniciais);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [reportados, setReportados] = useState<string[]>([]);

  if (cupons.length === 0) return null;

  function copiar(c: CupomVitrine) {
    navigator.clipboard.writeText(c.codigo);
    setCopiadoId(c.id);
    setTimeout(() => setCopiadoId(null), 1500);
  }

  async function reportar(id: string) {
    if (reportados.includes(id)) return;
    setReportados((r) => [...r, id]);
    const res = await fetch(`/api/cupons/${id}/reportar`, { method: "POST" });
    if (res.ok) {
      const data = (await res.json()) as { cupom?: CupomVitrine };
      if (data.cupom) {
        setCupons((lista) => lista.map((c) => (c.id === id ? data.cupom! : c)));
      }
    }
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <p className="sobrelinha">RADAR DE CUPONS ATIVOS</p>
        <span className="num text-xs text-tinta-3">{cupons.length} disponiveis</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cupons.map((c) => (
          <div key={c.id} className="caixa hachura flex flex-col justify-between p-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="selo selo-info uppercase">{c.loja}</span>
                <span className={`selo ${c.status === "ativo" ? "selo-ok" : "selo-alerta"}`}>
                  {c.status}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-tinta-2">{c.descricao}</p>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-linha pt-2.5">
              <button
                type="button"
                onClick={() => copiar(c)}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-dashed border-linha-forte bg-rebaixo px-2.5 py-1 font-mono text-xs font-bold text-tinta hover:border-tinta"
              >
                <Ticket className="h-3 w-3 text-info" />
                <span>{c.codigo}</span>
                {copiadoId === c.id ? (
                  <Check className="h-3 w-3 text-ok" />
                ) : (
                  <Copy className="h-3 w-3 text-tinta-3" />
                )}
              </button>

              <button
                type="button"
                onClick={() => reportar(c.id)}
                disabled={reportados.includes(c.id)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-tinta-3 hover:text-alerta disabled:opacity-50"
                title="Avisar que o cupom expirou"
              >
                <Flag className="h-3 w-3" />
                <span>{reportados.includes(c.id) ? "Reportado" : "Expirou?"}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function BotaoGarimpar() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function garimpar() {
    setCarregando(true);
    setAviso(null);
    try {
      const res = await fetch("/api/fontes/coletar", { method: "POST" });
      const data = (await res.json()) as {
        resultados?: Array<{ novas: number; duplicadas: number; erro?: string }>;
      };
      const novas = (data.resultados || []).reduce((acc, r) => acc + (r.novas || 0), 0);
      const dup = (data.resultados || []).reduce((acc, r) => acc + (r.duplicadas || 0), 0);
      setAviso(`${novas} novas · ${dup} repetidas barradas`);
      router.refresh();
    } catch {
      setAviso("Erro ao coletar fontes.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={garimpar}
        disabled={carregando}
        className="btn-primario"
      >
        <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
        <span>{carregando ? "Garimpando..." : "Garimpar agora"}</span>
      </button>
      {aviso && (
        <span className="text-xs font-semibold text-ok">
          {aviso}
        </span>
      )}
    </div>
  );
}
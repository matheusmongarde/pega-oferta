"use client";

import { useEffect, useState } from "react";
import { Check, ImagePlus, Save, Trash2 } from "lucide-react";

export function IdentidadeMarcaCard() {
  const [arroba, setArroba] = useState("@pegaoferta");
  const [logoUrl, setLogoUrl] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d: { config?: { arroba_marca?: string; logo_data_url?: string } }) => {
        if (d.config?.arroba_marca) setArroba(d.config.arroba_marca);
        if (d.config?.logo_data_url) setLogoUrl(d.config.logo_data_url);
      })
      .catch(() => {});
  }, []);

  function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800_000) {
      alert("Escolha uma logo menor que 800KB (PNG, JPG ou SVG).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setLogoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function salvar() {
    setSalvando(true);
    setSalvo(false);
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arroba_marca: arroba.trim() || "@pegaoferta", logo_data_url: logoUrl }),
      });
      if (res.ok) {
        setSalvo(true);
        setTimeout(() => setSalvo(false), 2500);
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="caixa hachura mb-6 p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo da marca"
              className="h-16 w-16 shrink-0 rounded-[14px] border border-linha bg-superficie object-cover"
            />
          ) : (
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[14px] border border-dashed border-linha-forte bg-rebaixo text-tinta-3">
              <ImagePlus className="h-6 w-6" />
            </div>
          )}
          <div>
            <p className="text-[15px] font-semibold text-tinta">
              Sua Logo e seu @ (Vitrine + Cards 9:16 + Painel)
            </p>
            <p className="text-xs text-tinta-3">
              Suba sua logo (PNG, JPG ou SVG) e informe o seu @ para sair automaticamente nos criativos e na vitrine.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border border-linha-forte bg-superficie px-3 text-xs font-semibold text-tinta hover:border-tinta-3">
                <ImagePlus className="h-3.5 w-3.5" />
                <span>Subir logo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={aoEscolherArquivo}
                  className="hidden"
                />
              </label>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl("")}
                  className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-linha-forte px-2.5 text-xs font-semibold text-tinta-3 hover:text-erro"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remover</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:w-72">
          <input
            type="text"
            value={arroba}
            onChange={(e) => setArroba(e.target.value)}
            placeholder="@seugrupo"
            className="campo font-mono text-sm"
          />
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-acao px-4 text-xs font-semibold text-acao-texto hover:bg-acao-forte disabled:opacity-60"
          >
            {salvo ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            <span>{salvo ? "Identidade salva!" : salvando ? "Salvando..." : "Salvar logo e @"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
"use client";

import { useEffect, useState } from "react";
import { Check, KeyRound, Loader2 } from "lucide-react";

/** AppID + Secret da Shopee Affiliate Open API: gera o link curto oficial que credita a venda. */
export function ShopeeApiCard() {
  const [appId, setAppId] = useState("");
  const [secret, setSecret] = useState("");
  const [configurado, setConfigurado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    fetch("/api/afiliados/shopee")
      .then((r) => r.json())
      .then((d: { configurado?: boolean; app_id?: string }) => {
        setConfigurado(Boolean(d.configurado));
        setAppId(d.app_id || "");
      })
      .catch(() => {});
  }, []);

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/afiliados/shopee", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: appId, secret }),
      });
      const d = (await r.json()) as {
        configurado?: boolean;
        teste?: { ok: boolean; link?: string; erro?: string } | null;
      };
      setConfigurado(Boolean(d.configurado));
      setSecret("");
      if (!d.configurado) setMsg({ ok: true, texto: "API desligada. Os links usam utm_source=an_<seu ID>." });
      else if (d.teste?.ok) setMsg({ ok: true, texto: `Funcionando! Link de teste: ${d.teste.link}` });
      else setMsg({ ok: false, texto: `Salvo, mas a Shopee recusou: ${d.teste?.erro || "erro desconhecido"}` });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-3 rounded-[12px] border border-linha bg-fundo/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold text-tinta">
          <KeyRound className="h-3.5 w-3.5" /> API oficial da Shopee (recomendado)
        </p>
        <span className={`selo ${configurado ? "selo-ok" : "selo-alerta"}`}>
          {configurado ? "ligada" : "desligada"}
        </span>
      </div>
      <p className="mb-2.5 text-[11.5px] leading-snug text-tinta-3">
        Gera o link curto s.shopee.com.br, que é o jeito garantido de a venda cair na sua conta. Peça o AppID e a Secret em
        affiliate.shopee.com.br → Open API.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          placeholder="AppID"
          className="campo font-mono text-xs"
        />
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={configurado ? "Secret salva (deixe vazio pra manter)" : "Secret"}
          className="campo font-mono text-xs"
          autoComplete="off"
        />
      </div>
      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-acao px-3 text-xs font-semibold text-acao-texto hover:bg-acao-forte disabled:opacity-60"
      >
        {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        <span>{salvando ? "Testando..." : "Salvar e testar"}</span>
      </button>
      {msg && (
        <p className={`mt-2 break-all text-[11.5px] font-semibold ${msg.ok ? "text-ok" : "text-erro"}`}>{msg.texto}</p>
      )}
    </div>
  );
}

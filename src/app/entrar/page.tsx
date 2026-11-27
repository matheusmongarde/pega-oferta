"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TelaAcesso } from "@/components/acesso/tela";
import "../acesso.css";

export default function EntrarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d: { instalado?: boolean; usuario?: unknown }) => {
        if (!d.instalado) router.replace("/instalar");
        else if (d.usuario) router.replace("/");
      })
      .catch(() => {});
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "entrar", email, senha }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
      if (!res.ok || !d.ok) {
        setErro(d.erro || "E-mail ou senha incorretos.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TelaAcesso
      titulo="Bom te ver de novo"
      sub="Suas fontes continuaram garimpando enquanto você esteve fora."
    >
      <form onSubmit={submit} className="ac-form">
        {erro && <p className="ac-aviso ac-aviso--erro">{erro}</p>}

        <label className="ac-campo">
          <span className="ac-rotulo">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ac-entrada"
            autoComplete="email"
            required
            autoFocus
          />
        </label>

        <label className="ac-campo">
          <span className="ac-rotulo">Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="ac-entrada"
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" disabled={enviando} className="ac-botao">
          {enviando ? "Entrando..." : "Entrar no painel"}
        </button>

        <p className="ac-linha-baixo">
          Este painel tem uma conta só: a de quem instalou nesta máquina.
        </p>
      </form>
    </TelaAcesso>
  );
}

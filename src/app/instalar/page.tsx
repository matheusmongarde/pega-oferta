"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TelaAcesso } from "@/components/acesso/tela";
import "../acesso.css";

export default function InstalarPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [operacao, setOperacao] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d: { instalado?: boolean; usuario?: unknown }) => {
        // Ja tem conta: logado segue pros passos da instalacao, deslogado vai entrar
        if (d.instalado) router.replace(d.usuario ? "/instalar/whatsapp" : "/entrar");
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
        body: JSON.stringify({ acao: "instalar", nome, operacao, email, senha }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
      if (!res.ok || !d.ok) {
        setErro(d.erro || "Não foi possível criar a conta.");
        return;
      }
      router.push("/instalar/whatsapp");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TelaAcesso
      titulo="Vamos montar sua máquina de ofertas"
      sub="Primeiro, a sua conta. Depois o WhatsApp, suas tags de afiliado e as fontes gratuitas, um por vez. Todo passo dá para pular."
    >
      <form onSubmit={submit} className="ac-form">
        {erro && <p className="ac-aviso ac-aviso--erro">{erro}</p>}

        <label className="ac-campo">
          <span className="ac-rotulo">Seu nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="ac-entrada"
            autoComplete="name"
            required
            autoFocus
            placeholder="Ex.: Matheus"
          />
        </label>

        <label className="ac-campo">
          <span className="ac-rotulo">Nome da sua operação / canal</span>
          <span className="ac-dica">Aparece no painel e na vitrine pública. Dá para trocar depois.</span>
          <input
            value={operacao}
            onChange={(e) => setOperacao(e.target.value)}
            className="ac-entrada"
            autoComplete="organization"
            required
            placeholder="Ex.: Achados do Dia"
          />
        </label>

        <label className="ac-campo">
          <span className="ac-rotulo">E-mail de acesso</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ac-entrada"
            autoComplete="email"
            required
            placeholder="voce@exemplo.com"
          />
        </label>

        <label className="ac-campo">
          <span className="ac-rotulo">Senha</span>
          <span className="ac-dica">Mínimo de 6 caracteres. Fica salva só no banco local.</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="ac-entrada"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>

        <button type="submit" disabled={enviando} className="ac-botao">
          {enviando ? "Criando conta..." : "Criar conta e continuar"}
        </button>

        <div className="ac-linha-baixo">
          <span className="ac-dica">Banco local: SQLite (pasta dados/)</span>
          <Link href="/" className="ac-link">
            Pular por agora
          </Link>
        </div>
      </form>
    </TelaAcesso>
  );
}

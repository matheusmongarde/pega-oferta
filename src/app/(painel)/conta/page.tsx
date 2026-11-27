"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import {
  AlertTriangle,
  Check,
  KeyRound,
  LogOut,
  RotateCcw,
  Save,
  Trash2,
  UserCheck,
} from "lucide-react";

interface Usuario {
  id: string;
  nome: string;
  operacao: string;
  email: string;
  criado_em: string;
}

export default function ContaPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [instalado, setInstalado] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const [nome, setNome] = useState("");
  const [operacao, setOperacao] = useState("");
  const [email, setEmail] = useState("");
  const [senhaNovaConta, setSenhaNovaConta] = useState("");

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const [confirmarLimparOfertas, setConfirmarLimparOfertas] = useState(false);
  const [confirmarResetConta, setConfirmarResetConta] = useState(false);
  const [executandoAcao, setExecutandoAcao] = useState<string | null>(null);

  async function carregar() {
    try {
      const res = await fetch("/api/auth");
      const data = (await res.json()) as {
        instalado?: boolean;
        usuario?: Usuario | null;
        operacao?: string;
      };
      setInstalado(Boolean(data.instalado));
      setUsuario(data.usuario || null);
      if (data.usuario) {
        setNome(data.usuario.nome);
        setOperacao(data.usuario.operacao);
        setEmail(data.usuario.email);
      } else {
        setOperacao(data.operacao || "Pega Oferta");
      }
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvarPerfil(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSalvandoPerfil(true);
    try {
      if (!instalado && email.trim() && senhaNovaConta) {
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            acao: "instalar",
            nome: nome.trim() || "Dono",
            operacao: operacao.trim() || "Pega Oferta",
            email: email.trim(),
            senha: senhaNovaConta,
          }),
        });
        const d = (await res.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
        if (!res.ok || !d.ok) {
          setFeedback({ tipo: "erro", texto: d.erro || "Não foi possível criar sua conta local." });
          return;
        }
        setSenhaNovaConta("");
        setFeedback({ tipo: "ok", texto: "Conta local criada e vinculada ao painel." });
        await carregar();
        router.refresh();
        return;
      }

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "atualizar_perfil",
          nome,
          operacao,
          email,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
      if (!res.ok || !d.ok) {
        setFeedback({ tipo: "erro", texto: d.erro || "Não foi possível salvar os dados." });
        return;
      }
      setFeedback({ tipo: "ok", texto: "Dados da conta atualizados." });
      await carregar();
      router.refresh();
    } finally {
      setSalvandoPerfil(false);
    }
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (novaSenha.length < 6) {
      setFeedback({ tipo: "erro", texto: "A nova senha precisa ter pelo menos 6 caracteres." });
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setFeedback({ tipo: "erro", texto: "A confirmação não confere com a nova senha." });
      return;
    }
    setSalvandoSenha(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "trocar_senha",
          senha_atual: senhaAtual,
          nova_senha: novaSenha,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
      if (!res.ok || !d.ok) {
        setFeedback({ tipo: "erro", texto: d.erro || "Senha atual incorreta." });
        return;
      }
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
      setFeedback({ tipo: "ok", texto: "Senha alterada com sucesso." });
    } finally {
      setSalvandoSenha(false);
    }
  }

  async function sair() {
    setExecutandoAcao("sair");
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "sair" }),
      });
      router.push("/entrar");
      router.refresh();
    } finally {
      setExecutandoAcao(null);
    }
  }

  async function limparOfertas() {
    if (!confirmarLimparOfertas) {
      setConfirmarLimparOfertas(true);
      return;
    }
    setExecutandoAcao("limpar");
    setFeedback(null);
    try {
      const res = await fetch("/api/limpar-dados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escopo: "ofertas_fila" }),
      });
      if (res.ok) {
        setConfirmarLimparOfertas(false);
        setFeedback({
          tipo: "ok",
          texto: "Ofertas, fila e histórico de ciclos limpos. Suas fontes, tags e WhatsApp foram mantidos.",
        });
        router.refresh();
      }
    } finally {
      setExecutandoAcao(null);
    }
  }

  async function resetarComecarDeNovo() {
    if (!confirmarResetConta) {
      setConfirmarResetConta(true);
      return;
    }
    setExecutandoAcao("resetar");
    setFeedback(null);
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "resetar_conta" }),
      });
      router.push("/instalar");
      router.refresh();
    } finally {
      setExecutandoAcao(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        sobrelinha="Conta"
        titulo="Sua conta local"
        subtitulo="Edite o nome da operação, troque sua senha de acesso ou recomece a configuração quando precisar."
        acoes={
          usuario ? (
            <button
              type="button"
              onClick={sair}
              disabled={executandoAcao === "sair"}
              className="btn-secundario"
            >
              <LogOut className="h-4 w-4" />
              Sair da conta
            </button>
          ) : null
        }
      />

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-[14px] border px-4 py-3 text-sm font-medium ${
            feedback.tipo === "ok"
              ? "border-verde/30 bg-verde/10 text-verde"
              : "border-vermelho/30 bg-vermelho/10 text-vermelho"
          }`}
        >
          {feedback.tipo === "ok" ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.texto}</span>
        </div>
      )}

      {carregando ? (
        <div className="rounded-[18px] bg-superficie p-6 text-sm text-tinta-3 shadow-[var(--sombra-card)]">
          Carregando dados da conta...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Dados da conta / operação */}
          <form
            onSubmit={salvarPerfil}
            className="space-y-4 rounded-[18px] bg-superficie p-6 shadow-[var(--sombra-card)]"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-rebaixo text-tinta">
                <UserCheck className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-tinta">
                  {usuario ? "Dados da conta" : "Proteger painel com login"}
                </h2>
                <p className="text-xs text-tinta-3">
                  {usuario
                    ? "Salvo localmente no SQLite da sua máquina."
                    : "Você pulou o cadastro inicial. Pode criar um login local agora ou apenas renomear a operação."}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-tinta-2">Nome da operação / canal</span>
                <input
                  value={operacao}
                  onChange={(e) => setOperacao(e.target.value)}
                  placeholder="Ex.: Achados do Dia"
                  required
                  className="w-full rounded-[12px] border border-linha bg-fundo px-3.5 py-2.5 text-sm text-tinta outline-none focus:border-tinta"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-tinta-2">Seu nome</span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Matheus"
                  className="w-full rounded-[12px] border border-linha bg-fundo px-3.5 py-2.5 text-sm text-tinta outline-none focus:border-tinta"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-tinta-2">E-mail de acesso</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="w-full rounded-[12px] border border-linha bg-fundo px-3.5 py-2.5 text-sm text-tinta outline-none focus:border-tinta"
                />
              </label>

              {!instalado && (
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-tinta-2">
                    Criar senha local (opcional, mín. 6 caracteres)
                  </span>
                  <input
                    type="password"
                    value={senhaNovaConta}
                    onChange={(e) => setSenhaNovaConta(e.target.value)}
                    minLength={6}
                    placeholder="Deixe vazio se quiser só trocar o nome da operação"
                    className="w-full rounded-[12px] border border-linha bg-fundo px-3.5 py-2.5 text-sm text-tinta outline-none focus:border-tinta"
                  />
                </label>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" disabled={salvandoPerfil} className="btn-primario">
                <Save className="h-4 w-4" />
                {salvandoPerfil ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>

          {/* Trocar senha */}
          <form
            onSubmit={trocarSenha}
            className="space-y-4 rounded-[18px] bg-superficie p-6 shadow-[var(--sombra-card)]"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-rebaixo text-tinta">
                <KeyRound className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-tinta">Trocar senha</h2>
                <p className="text-xs text-tinta-3">
                  {usuario
                    ? "Altere a senha usada para entrar no painel."
                    : "Crie uma conta ao lado primeiro para habilitar senha de acesso."}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-tinta-2">Senha atual</span>
                <input
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  disabled={!usuario}
                  required
                  className="w-full rounded-[12px] border border-linha bg-fundo px-3.5 py-2.5 text-sm text-tinta outline-none focus:border-tinta disabled:opacity-50"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-tinta-2">Nova senha</span>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  disabled={!usuario}
                  minLength={6}
                  required
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-[12px] border border-linha bg-fundo px-3.5 py-2.5 text-sm text-tinta outline-none focus:border-tinta disabled:opacity-50"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-tinta-2">Confirmar nova senha</span>
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  disabled={!usuario}
                  minLength={6}
                  required
                  className="w-full rounded-[12px] border border-linha bg-fundo px-3.5 py-2.5 text-sm text-tinta outline-none focus:border-tinta disabled:opacity-50"
                />
              </label>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={!usuario || salvandoSenha}
                className="btn-primario disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" />
                {salvandoSenha ? "Atualizando..." : "Atualizar senha"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Resetar / Começar de novo */}
      <section className="rounded-[18px] border border-linha bg-superficie p-6 shadow-[var(--sombra-card)]">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-vermelho/10 text-vermelho">
            <RotateCcw className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-tinta">Resetar e começar de novo</h2>
            <p className="text-xs text-tinta-3">
              Ações para limpar o catálogo ou recomeçar a instalação do zero.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col justify-between gap-3 rounded-[14px] border border-linha bg-fundo p-4">
            <div>
              <p className="text-sm font-bold text-tinta">Limpar ofertas e fila</p>
              <p className="mt-0.5 text-xs text-tinta-3">
                Apaga todas as ofertas coletadas e a fila de disparos. Mantém suas fontes, tags de afiliado e WhatsApp conectados.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={limparOfertas}
                disabled={executandoAcao === "limpar"}
                className={`btn-secundario text-xs ${
                  confirmarLimparOfertas ? "!border-vermelho !text-vermelho" : ""
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmarLimparOfertas ? "Clique de novo para confirmar" : "Limpar ofertas e fila"}
              </button>
              {confirmarLimparOfertas && (
                <button
                  type="button"
                  onClick={() => setConfirmarLimparOfertas(false)}
                  className="text-xs font-semibold text-tinta-3 hover:text-tinta"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-[14px] border border-linha bg-fundo p-4">
            <div>
              <p className="text-sm font-bold text-tinta">Resetar conta e começar do zero</p>
              <p className="mt-0.5 text-xs text-tinta-3">
                Remove o usuário atual e abre o assistente de configuração inicial para criar outra conta do zero.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetarComecarDeNovo}
                disabled={executandoAcao === "resetar"}
                className={`btn-secundario text-xs ${
                  confirmarResetConta ? "!border-vermelho !bg-vermelho !text-white" : "!text-vermelho"
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {confirmarResetConta ? "Confirmar reset da conta" : "Começar de novo"}
              </button>
              {confirmarResetConta && (
                <button
                  type="button"
                  onClick={() => setConfirmarResetConta(false)}
                  className="text-xs font-semibold text-tinta-3 hover:text-tinta"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
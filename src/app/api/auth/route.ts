import { NextResponse } from "next/server";
import {
  atualizarPerfilUsuario,
  atualizarSenhaUsuario,
  autenticarUsuario,
  criarContaInicial,
  definirSessaoCookie,
  estaInstalado,
  limparSessaoCookie,
  resetarContaLocal,
  usuarioAtual,
} from "@/lib/auth";
import { getConfigOperacao, salvarConfigOperacao } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const instalado = estaInstalado();
  const usuario = await usuarioAtual();
  const config = getConfigOperacao();
  return NextResponse.json({
    instalado,
    usuario,
    operacao: usuario?.operacao || config.nome_vitrine || "Pega Oferta",
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    acao?: "instalar" | "entrar" | "sair" | "trocar_senha" | "atualizar_perfil" | "resetar_conta";
    nome?: string;
    operacao?: string;
    email?: string;
    senha?: string;
    senha_atual?: string;
    nova_senha?: string;
  };

  if (body.acao === "sair") {
    await limparSessaoCookie();
    return NextResponse.json({ ok: true });
  }

  if (body.acao === "instalar") {
    if (estaInstalado()) {
      return NextResponse.json(
        { erro: "Já existe uma conta cadastrada. Faça login em /entrar." },
        { status: 409 }
      );
    }
    if (!body.email?.trim() || !body.senha || body.senha.length < 6) {
      return NextResponse.json(
        { erro: "Informe e-mail e senha com pelo menos 6 caracteres." },
        { status: 400 }
      );
    }
    try {
      const usuario = criarContaInicial({
        nome: body.nome || "Dono",
        operacao: body.operacao || "Pega Oferta",
        email: body.email,
        senha: body.senha,
      });
      await definirSessaoCookie(usuario.id);
      return NextResponse.json({ ok: true, usuario }, { status: 201 });
    } catch {
      return NextResponse.json(
        { erro: "Não foi possível criar a conta (e-mail já em uso)." },
        { status: 400 }
      );
    }
  }

  if (body.acao === "entrar") {
    if (!body.email?.trim() || !body.senha) {
      return NextResponse.json({ erro: "Informe e-mail e senha." }, { status: 400 });
    }
    const usuario = autenticarUsuario(body.email, body.senha);
    if (!usuario) {
      return NextResponse.json({ erro: "E-mail ou senha incorretos." }, { status: 401 });
    }
    await definirSessaoCookie(usuario.id);
    return NextResponse.json({ ok: true, usuario });
  }

  if (body.acao === "atualizar_perfil") {
    const u = await usuarioAtual();
    if (!u) {
      if (body.operacao?.trim()) {
        salvarConfigOperacao({ nome_vitrine: body.operacao.trim() });
        return NextResponse.json({ ok: true, operacao: body.operacao.trim() });
      }
      return NextResponse.json({ erro: "Faça login para editar a conta." }, { status: 401 });
    }
    try {
      const atualizado = atualizarPerfilUsuario(u.id, {
        nome: body.nome,
        operacao: body.operacao,
        email: body.email,
      });
      return NextResponse.json({ ok: true, usuario: atualizado });
    } catch {
      return NextResponse.json({ erro: "E-mail já está em uso." }, { status: 400 });
    }
  }

  if (body.acao === "trocar_senha") {
    const u = await usuarioAtual();
    if (!u) {
      return NextResponse.json({ erro: "Faça login para trocar a senha." }, { status: 401 });
    }
    if (!body.senha_atual || !body.nova_senha || body.nova_senha.length < 6) {
      return NextResponse.json(
        { erro: "A nova senha precisa ter pelo menos 6 caracteres." },
        { status: 400 }
      );
    }
    const ok = atualizarSenhaUsuario(u.id, body.senha_atual, body.nova_senha);
    if (!ok) {
      return NextResponse.json({ erro: "Senha atual incorreta." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.acao === "resetar_conta") {
    resetarContaLocal();
    await limparSessaoCookie();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
}
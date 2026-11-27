import { NextResponse } from "next/server";
import {
  lerPadraoCupom,
  resolverLinksLojasComAfiliado,
  salvarPadraoCupom,
  type PadraoCupom,
} from "@/lib/cupom-padrao-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const padrao = lerPadraoCupom();
  const linksResolvidos = resolverLinksLojasComAfiliado(padrao);
  return NextResponse.json({ padrao, linksResolvidos });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<PadraoCupom>;
  const atual = lerPadraoCupom();

  const proximo: PadraoCupom = {
    estilo:
      body.estilo === "dark" || body.estilo === "personalizado" || body.estilo === "oficial"
        ? body.estilo
        : atual.estilo,
    titulo: typeof body.titulo === "string" ? body.titulo.slice(0, 60) : atual.titulo,
    subtitulo: typeof body.subtitulo === "string" ? body.subtitulo.slice(0, 90) : atual.subtitulo,
    chamada: typeof body.chamada === "string" ? body.chamada.slice(0, 90) : atual.chamada,
    mostrarLogoLoja:
      typeof body.mostrarLogoLoja === "boolean" ? body.mostrarLogoLoja : atual.mostrarLogoLoja,
    mostrarArroba:
      typeof body.mostrarArroba === "boolean" ? body.mostrarArroba : atual.mostrarArroba,
    templateMensagem:
      typeof body.templateMensagem === "string"
        ? body.templateMensagem.slice(0, 1200)
        : atual.templateMensagem,
    fundoDataUrl:
      typeof body.fundoDataUrl === "string" ? body.fundoDataUrl.slice(0, 3_000_000) : atual.fundoDataUrl,
    linksPorLoja:
      body.linksPorLoja && typeof body.linksPorLoja === "object"
        ? { ...atual.linksPorLoja, ...body.linksPorLoja }
        : atual.linksPorLoja,
  };

  salvarPadraoCupom(proximo);
  const linksResolvidos = resolverLinksLojasComAfiliado(proximo);
  return NextResponse.json({ ok: true, padrao: proximo, linksResolvidos });
}

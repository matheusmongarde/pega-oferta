import { NextResponse } from "next/server";
import { getDb, type Fonte } from "@/lib/db";
import { coletarFonteRss, type ResultadoColeta } from "@/lib/coletor";

export const dynamic = "force-dynamic";

let coletandoAgora = false;
let ultimaExecucao: string | null = null;
let novasUltima = 0;
let duplicadasUltima = 0;

export async function GET() {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as total FROM fontes WHERE tipo = 'rss' AND ativa = 1")
    .get() as { total: number };
  return NextResponse.json({
    rodando: coletandoAgora,
    ultima_execucao: ultimaExecucao,
    novas_ultima: novasUltima,
    duplicadas_ultima: duplicadasUltima,
    fontes_ativas: row.total,
    intervalo_segundos: 20,
  });
}

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json().catch(() => ({}))) as {
    fonte_id?: string;
    automatico?: boolean;
  };

  if (coletandoAgora && body.automatico) {
    return NextResponse.json({ pulado: true, motivo: "Coleta anterior ainda em andamento.", resultados: [] });
  }

  const fontes = (
    body.fonte_id
      ? db.prepare("SELECT * FROM fontes WHERE id = ?").all(body.fonte_id)
      : db.prepare("SELECT * FROM fontes WHERE tipo = 'rss' AND ativa = 1").all()
  ) as unknown as Fonte[];

  if (fontes.length === 0) {
    return NextResponse.json({ resultados: [], novas: 0, duplicadas: 0 });
  }

  coletandoAgora = true;
  try {
    const settled = await Promise.allSettled(fontes.map((f) => coletarFonteRss(f)));
    const resultados: ResultadoColeta[] = settled.map((item, i) => {
      if (item.status === "fulfilled") return item.value;
      return {
        fonte_id: fontes[i].id,
        fonte_nome: fontes[i].nome,
        lidas: 0,
        novas: 0,
        duplicadas: 0,
        filtradas: 0,
        erro: item.reason instanceof Error ? item.reason.message : "Erro inesperado na coleta.",
      };
    });

    const novas = resultados.reduce((acc, r) => acc + (r.novas || 0), 0);
    const duplicadas = resultados.reduce((acc, r) => acc + (r.duplicadas || 0), 0);
    ultimaExecucao = new Date().toISOString();
    novasUltima = novas;
    duplicadasUltima = duplicadas;

    return NextResponse.json({ resultados, novas, duplicadas });
  } finally {
    coletandoAgora = false;
  }
}
import { NextResponse } from "next/server";

const WA_URL = (process.env.WHATSAPP_URL || "http://127.0.0.1:4320").replace(/\/+$/, "");
const WA_TOKEN = process.env.WHATSAPP_TOKEN || "";

function headers() {
  return {
    "Content-Type": "application/json",
    ...(WA_TOKEN ? { "x-whatsapp-token": WA_TOKEN } : {}),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const conviteJid = searchParams.get("convite");
  const instancia = searchParams.get("instancia") || "";
  const forcar = searchParams.get("forcar") || "";

  if (conviteJid) {
    try {
      const qs = new URLSearchParams({ jid: conviteJid });
      if (instancia) qs.set("instancia", instancia);
      const res = await fetch(`${WA_URL}/convite?${qs.toString()}`, {
        headers: headers(),
      });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    } catch {
      return NextResponse.json({ erro: "Servico do WhatsApp offline." }, { status: 503 });
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const qsGrupos = new URLSearchParams();
    if (instancia) qsGrupos.set("instancia", instancia);
    if (forcar === "1") qsGrupos.set("forcar", "1");
    const gruposUrl = `${WA_URL}/grupos${qsGrupos.toString() ? `?${qsGrupos.toString()}` : ""}`;
    const [stRes, grRes] = await Promise.all([
      fetch(`${WA_URL}/status`, { headers: headers(), signal: controller.signal, cache: "no-store" }),
      fetch(gruposUrl, { headers: headers(), signal: controller.signal, cache: "no-store" }).catch(() => null),
    ]);
    clearTimeout(timer);
    if (!stRes.ok) {
      return NextResponse.json({ online: false, estado: "offline", grupos: [], instancias: [] });
    }
    const status = (await stRes.json()) as Record<string, unknown>;
    const gruposData = grRes && grRes.ok ? ((await grRes.json()) as { grupos?: unknown[] }) : { grupos: [] };
    return NextResponse.json({
      online: true,
      ...status,
      grupos: gruposData.grupos || [],
    });
  } catch {
    return NextResponse.json({
      online: false,
      estado: "offline",
      qr: null,
      numero: null,
      grupos: [],
      instancias: [],
    });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    acao?: "conectar" | "desconectar" | "espelho" | "enviar";
    instancia?: string;
    nova?: boolean;
    nome?: string;
    grupos?: string[];
    destino?: string;
    texto?: string;
    imagem_url?: string;
  };
  const acao = body.acao || "conectar";

  try {
    const res = await fetch(`${WA_URL}/${acao}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      {
        erro: "Servico local do WhatsApp nao esta rodando. Execute: npm run tudo",
      },
      { status: 503 }
    );
  }
}

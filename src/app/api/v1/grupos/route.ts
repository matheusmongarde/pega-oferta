import { NextResponse } from "next/server";
import { autenticarApiV1 } from "@/lib/api-tokens";

export const dynamic = "force-dynamic";

const WA_URL = (process.env.WHATSAPP_URL || "http://127.0.0.1:4320").replace(/\/+$/, "");

export async function GET(req: Request) {
  if (!autenticarApiV1(req).ok) {
    return NextResponse.json(
      { erro: "Token de API invalido ou ausente. Envie Authorization: Bearer po_live_..." },
      { status: 401 }
    );
  }
  try {
    const [stRes, grRes] = await Promise.all([
      fetch(`${WA_URL}/status`, { cache: "no-store" }),
      fetch(`${WA_URL}/grupos?instancia=todas`, { cache: "no-store" }),
    ]);
    const st = stRes.ok ? await stRes.json() : { instancias: [] };
    const gr = grRes.ok ? await grRes.json() : { grupos: [] };
    return NextResponse.json({
      instancias: st.instancias || [],
      grupos: gr.grupos || [],
    });
  } catch {
    return NextResponse.json({ erro: "Servico WhatsApp offline.", instancias: [], grupos: [] }, { status: 503 });
  }
}

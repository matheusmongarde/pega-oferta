import { NextResponse } from "next/server";
import { getDb, type Conexao } from "@/lib/db";

export async function POST(req: Request) {
  const db = getDb();
  const body = (await req.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ erro: "ID da conexao obrigatorio." }, { status: 400 });
  }

  const cnx = db.prepare("SELECT * FROM conexoes WHERE id = ?").get(body.id) as
    | Conexao
    | undefined;
  if (!cnx) {
    return NextResponse.json({ erro: "Conexao nao encontrada." }, { status: 404 });
  }

  try {
    if (cnx.tipo === "telegram") {
      if (!cnx.token) {
        return NextResponse.json({ ok: false, detalhe: "Cole o token do @BotFather primeiro." });
      }
      const res = await fetch(`https://api.telegram.org/bot${cnx.token}/getMe`);
      const data = (await res.json()) as { ok?: boolean; result?: { username?: string }; description?: string };
      const ok = Boolean(res.ok && data.ok);
      const status = ok ? "conectada" : "erro";
      db.prepare("UPDATE conexoes SET ultimo_status = ? WHERE id = ?").run(status, cnx.id);
      return NextResponse.json({
        ok,
        detalhe: ok
          ? `Bot @${data.result?.username || "ok"} autenticado com sucesso.`
          : data.description || "Token invalido.",
      });
    }

    if (cnx.tipo === "whatsapp_evolution") {
      if (!cnx.endpoint || !cnx.instancia || !cnx.token) {
        return NextResponse.json({ ok: false, detalhe: "Preencha URL, instancia e apikey." });
      }
      const base = cnx.endpoint.replace(/\/+$/, "");
      const res = await fetch(`${base}/instance/connectionState/${encodeURIComponent(cnx.instancia)}`, {
        headers: { apikey: cnx.token },
      });
      const ok = res.ok;
      db.prepare("UPDATE conexoes SET ultimo_status = ? WHERE id = ?").run(
        ok ? "conectada" : "erro",
        cnx.id
      );
      return NextResponse.json({
        ok,
        detalhe: ok
          ? "Evolution API respondeu com sucesso."
          : `Evolution API retornou HTTP ${res.status}.`,
      });
    }

    if (cnx.endpoint) {
      const res = await fetch(cnx.endpoint, { method: "HEAD" }).catch(() => null);
      const ok = Boolean(res);
      db.prepare("UPDATE conexoes SET ultimo_status = ? WHERE id = ?").run(
        ok ? "conectada" : "erro",
        cnx.id
      );
      return NextResponse.json({
        ok,
        detalhe: ok ? "Endpoint acessivel." : "Nao foi possivel alcancar a URL.",
      });
    }

    return NextResponse.json({ ok: false, detalhe: "Preencha os campos da conexao." });
  } catch (err) {
    db.prepare("UPDATE conexoes SET ultimo_status = 'erro' WHERE id = ?").run(cnx.id);
    return NextResponse.json({
      ok: false,
      detalhe: err instanceof Error ? err.message : "Erro ao testar conexao.",
    });
  }
}

import {
  getConfigOperacao,
  getDb,
  gerarId,
  type Conexao,
  type Marca,
  type Oferta,
} from "./db";
import { formatarMensagemOferta } from "./parser";

export interface ResultadoDisparo {
  ok: boolean;
  status: "enviado" | "simulado" | "erro" | "bloqueado";
  detalhe: string;
  mensagem: string;
  enviosCriados: number;
}

function dentroDaJanela(inicio: string, fim: string): boolean {
  const agora = new Date();
  const minAtual = agora.getHours() * 60 + agora.getMinutes();
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fim.split(":").map(Number);
  const minInicio = (hi || 0) * 60 + (mi || 0);
  const minFim = (hf || 23) * 60 + (mf || 59);
  return minAtual >= minInicio && minAtual <= minFim;
}

function contarEnviosHoje(): number {
  const db = getDb();
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const row = db
    .prepare(
      "SELECT COUNT(*) as total FROM envios WHERE status IN ('enviado', 'simulado') AND criado_em >= ?"
    )
    .get(inicioHoje.toISOString()) as { total: number };
  return row.total;
}

async function enviarParaConexao(
  conexao: Conexao,
  mensagem: string,
  imagemUrl: string
): Promise<{ ok: boolean; detalhe: string }> {
  try {
    if (conexao.tipo === "telegram") {
      if (!conexao.token || !conexao.destino) {
        return { ok: false, detalhe: "Token ou Chat ID do Telegram nao configurado." };
      }
      const endpoint = imagemUrl
        ? `https://api.telegram.org/bot${conexao.token}/sendPhoto`
        : `https://api.telegram.org/bot${conexao.token}/sendMessage`;

      const body = imagemUrl
        ? {
            chat_id: conexao.destino,
            photo: imagemUrl,
            caption: mensagem,
            parse_mode: "Markdown",
          }
        : {
            chat_id: conexao.destino,
            text: mensagem,
            parse_mode: "Markdown",
            disable_web_page_preview: false,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; description?: string };
      if (!res.ok || !data.ok) {
        return { ok: false, detalhe: data.description || `Telegram HTTP ${res.status}` };
      }
      return { ok: true, detalhe: "Enviado via Telegram Bot API." };
    }

    if (conexao.tipo === "whatsapp_evolution") {
      if (!conexao.endpoint || !conexao.instancia || !conexao.token || !conexao.destino) {
        return { ok: false, detalhe: "Configure URL, instancia, apikey e grupo na Evolution API." };
      }
      const base = conexao.endpoint.replace(/\/+$/, "");
      const url = imagemUrl ? `${base}/message/sendMedia/${encodeURIComponent(conexao.instancia)}` : `${base}/message/sendText/${encodeURIComponent(conexao.instancia)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: conexao.token,
        },
        body: JSON.stringify(imagemUrl ? { number: conexao.destino, mediatype: "image", media: imagemUrl, caption: mensagem } : { number: conexao.destino, text: mensagem }),
      });
      if (!res.ok) {
        return { ok: false, detalhe: `Evolution API retornou HTTP ${res.status}.` };
      }
      return { ok: true, detalhe: "Enviado via Evolution API." };
    }

    if (conexao.tipo === "whatsapp_zapi") {
      if (!conexao.endpoint || !conexao.destino) {
        return { ok: false, detalhe: "Configure a URL da Z-API e o destino." };
      }
      const res = await fetch(conexao.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(conexao.token ? { "Client-Token": conexao.token } : {}),
        },
        body: JSON.stringify({
          phone: conexao.destino,
          message: mensagem,
        }),
      });
      if (!res.ok) {
        return { ok: false, detalhe: `Z-API retornou HTTP ${res.status}.` };
      }
      return { ok: true, detalhe: "Enviado via Z-API." };
    }

    if (conexao.tipo === "whatsapp_baileys") {
      const base = (conexao.endpoint || process.env.WHATSAPP_URL || "http://127.0.0.1:4320").replace(/\/+$/, "");
      if (!conexao.destino) {
        return { ok: false, detalhe: "Informe o JID do grupo ou numero destino." };
      }
      const res = await fetch(`${base}/enviar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(conexao.token ? { "x-whatsapp-token": conexao.token } : {}),
        },
        body: JSON.stringify({ destino: conexao.destino, texto: mensagem, imagem_url: imagemUrl }),
      });
      if (!res.ok) {
        return { ok: false, detalhe: `Servico Baileys retornou HTTP ${res.status}.` };
      }
      return { ok: true, detalhe: "Enviado via WhatsApp QR (Baileys)." };
    }

    if (conexao.tipo === "webhook") {
      if (!conexao.endpoint) {
        return { ok: false, detalhe: "URL do webhook nao configurada." };
      }
      const res = await fetch(conexao.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(conexao.token ? { Authorization: `Bearer ${conexao.token}` } : {}),
        },
        body: JSON.stringify({
          destino: conexao.destino,
          mensagem,
          imagem_url: imagemUrl,
        }),
      });
      if (!res.ok) {
        return { ok: false, detalhe: `Webhook retornou HTTP ${res.status}.` };
      }
      return { ok: true, detalhe: "Enviado via Webhook." };
    }

    return { ok: false, detalhe: "Tipo de conexao desconhecido." };
  } catch (err) {
    return {
      ok: false,
      detalhe: err instanceof Error ? err.message : "Falha na comunicacao externa.",
    };
  }
}

export async function dispararOferta(
  ofertaId: string,
  ignorarTravas = false
): Promise<ResultadoDisparo> {
  const db = getDb();
  const oferta = db
    .prepare("SELECT * FROM ofertas WHERE id = ?")
    .get(ofertaId) as Oferta | undefined;
  if (!oferta) {
    return {
      ok: false,
      status: "erro",
      detalhe: "Oferta nao encontrada.",
      mensagem: "",
      enviosCriados: 0,
    };
  }

  const marca = db
    .prepare("SELECT * FROM marcas WHERE id = ?")
    .get(oferta.marca_id) as Marca | undefined;
  if (!marca) {
    return {
      ok: false,
      status: "erro",
      detalhe: "Marca nao encontrada.",
      mensagem: "",
      enviosCriados: 0,
    };
  }

  const cfg = getConfigOperacao();
  const mensagem = formatarMensagemOferta(oferta, marca.template_mensagem);

  // Travas de seguranca (anti-ban)
  if (!ignorarTravas && !cfg.modo_teste) {
    const hoje = contarEnviosHoje();
    if (hoje >= cfg.limite_diario) {
      db.prepare(
        "INSERT INTO envios (id, oferta_id, conexao_id, canal, destino, status, detalhe, mensagem, criado_em) VALUES (?, ?, NULL, 'sistema', 'limite', 'bloqueado', ?, ?, ?)"
      ).run(
        gerarId("env"),
        oferta.id,
        `Limite diario de ${cfg.limite_diario} envios atingido.`,
        mensagem,
        new Date().toISOString()
      );
      return {
        ok: false,
        status: "bloqueado",
        detalhe: `Limite diario (${cfg.limite_diario}) atingido.`,
        mensagem,
        enviosCriados: 1,
      };
    }

    if (!dentroDaJanela(cfg.horario_inicio, cfg.horario_fim)) {
      db.prepare(
        "INSERT INTO envios (id, oferta_id, conexao_id, canal, destino, status, detalhe, mensagem, criado_em) VALUES (?, ?, NULL, 'sistema', 'horario', 'bloqueado', ?, ?, ?)"
      ).run(
        gerarId("env"),
        oferta.id,
        `Fora da janela permitida (${cfg.horario_inicio} - ${cfg.horario_fim}).`,
        mensagem,
        new Date().toISOString()
      );
      return {
        ok: false,
        status: "bloqueado",
        detalhe: `Fora da janela de envio (${cfg.horario_inicio}–${cfg.horario_fim}).`,
        mensagem,
        enviosCriados: 1,
      };
    }
  }

  const conexoes = db
    .prepare("SELECT * FROM conexoes WHERE marca_id = ? AND ativa = 1")
    .all(marca.id) as unknown as Conexao[];

  if (cfg.modo_teste || conexoes.length === 0) {
    const destino = conexoes[0]?.destino || "simulacao-local";
    const canal = conexoes[0]?.tipo || "simulacao";
    const detalhe = cfg.modo_teste
      ? "Modo teste ativo — mensagem gerada e registrada sem disparar para grupos."
      : "Nenhuma conexao ativa vinculada a esta marca.";

    db.prepare(
      "INSERT INTO envios (id, oferta_id, conexao_id, canal, destino, status, detalhe, mensagem, criado_em) VALUES (?, ?, ?, ?, ?, 'simulado', ?, ?, ?)"
    ).run(
      gerarId("env"),
      oferta.id,
      conexoes[0]?.id || null,
      canal,
      destino,
      detalhe,
      mensagem,
      new Date().toISOString()
    );

    db.prepare("UPDATE ofertas SET status = 'enviada', enviada_em = ? WHERE id = ?").run(
      new Date().toISOString(),
      oferta.id
    );

    return {
      ok: true,
      status: "simulado",
      detalhe,
      mensagem,
      enviosCriados: 1,
    };
  }

  let sucessos = 0;
  let ultimoDetalhe = "";

  for (const cnx of conexoes) {
    const r = await enviarParaConexao(cnx, mensagem, oferta.imagem_url);
    db.prepare(
      "INSERT INTO envios (id, oferta_id, conexao_id, canal, destino, status, detalhe, mensagem, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      gerarId("env"),
      oferta.id,
      cnx.id,
      cnx.tipo,
      cnx.destino || cnx.nome,
      r.ok ? "enviado" : "erro",
      r.detalhe,
      mensagem,
      new Date().toISOString()
    );
    if (r.ok) sucessos++;
    ultimoDetalhe = r.detalhe;
  }

  if (sucessos > 0) {
    db.prepare("UPDATE ofertas SET status = 'enviada', enviada_em = ? WHERE id = ?").run(
      new Date().toISOString(),
      oferta.id
    );
  }

  return {
    ok: sucessos > 0,
    status: sucessos > 0 ? "enviado" : "erro",
    detalhe:
      sucessos > 0
        ? `Enviada para ${sucessos} de ${conexoes.length} conexao(oes).`
        : ultimoDetalhe || "Falha ao enviar para as conexoes.",
    mensagem,
    enviosCriados: conexoes.length,
  };
}

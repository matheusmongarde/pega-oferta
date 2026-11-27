import { gerarId, getConfigOperacao, type Fonte, type Marca } from "./db";
import { getDbV4, getConfigAutomacao, registrarLogAutomacao, type MonitorPreco } from "./db-v4";
import { registrarPrecoHistorico } from "./db-v3";
import { coletarFonteRss } from "./coletor";
import { dispararOferta } from "./disparador";
import { extrairMetadadosUrl } from "./scraper-og";
import { converterLinkAfiliado, detectarLoja, extrairHashDedup } from "./afiliado";

export interface ResultadoMonitor {
  monitor_id: string;
  titulo: string;
  preco_anterior: number;
  preco_atual: number;
  alvo_atingido: boolean;
  oferta_criada_id: string | null;
}

export async function checarMonitor(monitorId: string): Promise<ResultadoMonitor | null> {
  const db = getDbV4();
  const monitor = db
    .prepare("SELECT * FROM monitores_preco WHERE id = ?")
    .get(monitorId) as unknown as MonitorPreco | undefined;
  if (!monitor) return null;

  const agora = new Date().toISOString();
  const meta = await extrairMetadadosUrl(monitor.url);

  const precoDetectado = meta.precoAtual > 0 ? meta.precoAtual : monitor.preco_atual;
  const menorPreco =
    precoDetectado > 0
      ? monitor.menor_preco > 0
        ? Math.min(monitor.menor_preco, precoDetectado)
        : precoDetectado
      : monitor.menor_preco;

  const imagem = meta.imagemUrl || monitor.imagem_url;
  const titulo = monitor.titulo || meta.tituloPagina || "Produto monitorado";
  const alvoAtingido = precoDetectado > 0 && monitor.preco_alvo > 0 && precoDetectado <= monitor.preco_alvo;
  const status = alvoAtingido ? "alvo_atingido" : "monitorando";

  db.prepare(`
    UPDATE monitores_preco
    SET titulo = ?, imagem_url = ?, preco_atual = ?, menor_preco = ?, status = ?, ultimo_check = ?
    WHERE id = ?
  `).run(titulo, imagem, precoDetectado, menorPreco, status, agora, monitor.id);

  let ofertaCriadaId: string | null = null;

  if (alvoAtingido) {
    const loja = detectarLoja(monitor.url);
    const hash = extrairHashDedup(monitor.url, titulo);
    registrarPrecoHistorico(hash, precoDetectado);

    const jaExiste = db
      .prepare("SELECT id FROM ofertas WHERE hash_dedup = ? AND criado_em >= ? LIMIT 1")
      .get(hash, new Date(Date.now() - 24 * 3600_000).toISOString()) as { id: string } | undefined;

    if (!jaExiste) {
      const marca = db.prepare("SELECT * FROM marcas LIMIT 1").get() as unknown as Marca | undefined;
      if (marca) {
        const conv = converterLinkAfiliado(monitor.url, {
          amazon_tag: marca.amazon_tag,
          shopee_id: marca.shopee_id,
          mercadolivre_tag: marca.mercadolivre_tag,
          aliexpress_id: marca.aliexpress_id,
          awin_id: marca.awin_id,
        });
        const precoAntigo =
          meta.precoAntigo > precoDetectado
            ? meta.precoAntigo
            : monitor.preco_atual > precoDetectado
            ? monitor.preco_atual
            : 0;
        const desconto =
          precoAntigo > precoDetectado ? Math.round(((precoAntigo - precoDetectado) / precoAntigo) * 100) : 0;

        ofertaCriadaId = gerarId("ofr");
        db.prepare(`
          INSERT INTO ofertas
            (id, marca_id, titulo, loja, url_original, url_afiliado, hash_dedup, preco_antigo, preco, desconto_pct, cupom, imagem_url, texto_original, status, cliques, exemplo, criado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, 'aprovada', 0, 0, ?)
        `).run(
          ofertaCriadaId,
          marca.id,
          titulo,
          loja,
          monitor.url,
          conv.urlAfiliado,
          hash,
          precoAntigo,
          precoDetectado,
          desconto,
          imagem,
          `[Monitor de Preco] ${titulo} atingiu R$ ${precoDetectado.toFixed(2)} (alvo R$ ${monitor.preco_alvo.toFixed(2)})`,
          agora
        );
      }
    }
  }

  return {
    monitor_id: monitor.id,
    titulo,
    preco_anterior: monitor.preco_atual,
    preco_atual: precoDetectado,
    alvo_atingido: alvoAtingido,
    oferta_criada_id: ofertaCriadaId,
  };
}

export async function executarCicloAutomacao(forcar = false) {
  const db = getDbV4();
  const cfg = getConfigAutomacao();
  const op = getConfigOperacao();

  if (!forcar && !cfg.ativo) {
    return { executado: false, motivo: "Piloto automatico desligado." };
  }

  let ofertasColetadas = 0;
  let monitoresChecados = 0;
  let alertasDisparados = 0;
  let enviosFeitos = 0;
  const notas: string[] = [];

  if (cfg.coletar_rss) {
    try {
      const fontes = db
        .prepare("SELECT * FROM fontes WHERE ativa = 1 AND tipo = 'rss'")
        .all() as unknown as Fonte[];
      for (const f of fontes) {
        const res = await coletarFonteRss(f);
        ofertasColetadas += res.novas || 0;
      }
      notas.push(`RSS: +${ofertasColetadas}`);
    } catch {
      notas.push("RSS: erro na coleta");
    }
  }

  if (cfg.checar_monitores) {
    const monitores = db
      .prepare("SELECT id FROM monitores_preco WHERE ativo = 1 LIMIT 12")
      .all() as unknown as Array<{ id: string }>;
    for (const m of monitores) {
      try {
        const res = await checarMonitor(m.id);
        monitoresChecados++;
        if (res?.oferta_criada_id) alertasDisparados++;
      } catch {
        /* proximo */
      }
    }
    notas.push(`Monitores: ${monitoresChecados} checados, ${alertasDisparados} alertas`);
  }

  if (cfg.disparar_aprovadas) {
    const aprovadas = db
      .prepare("SELECT id FROM ofertas WHERE status = 'aprovada' ORDER BY criado_em ASC LIMIT 3")
      .all() as unknown as Array<{ id: string }>;
    for (const o of aprovadas) {
      const r = await dispararOferta(o.id);
      if (r.ok) enviosFeitos++;
    }
    notas.push(`Disparos: ${enviosFeitos} (${op.modo_teste ? "simulacao" : "producao"})`);
  }

  const detalhe = notas.join(" | ") || "Ciclo concluido sem pendencias.";
  registrarLogAutomacao({
    ofertas_coletadas: ofertasColetadas,
    monitores_checados: monitoresChecados,
    alertas_disparados: alertasDisparados,
    envios_feitos: enviosFeitos,
    detalhe,
  });

  return {
    executado: true,
    ofertas_coletadas: ofertasColetadas,
    monitores_checados: monitoresChecados,
    alertas_disparados: alertasDisparados,
    envios_feitos: enviosFeitos,
    detalhe,
  };
}

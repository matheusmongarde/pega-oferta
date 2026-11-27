import { gerarId } from "./db";

function lerCfg(chave: string, padrao: string): string {
  const db = getDbV3();
  const row = db.prepare("SELECT valor FROM configuracoes WHERE chave = ?").get(chave) as { valor: string } | undefined;
  return row?.valor ?? padrao;
}

function gravarCfg(chave: string, valor: string) {
  const db = getDbV3();
  db.prepare("INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").run(chave, valor);
}
import { getDbV3 } from "./db-v3";

export interface MonitorPreco {
  id: string;
  titulo: string;
  url: string;
  loja: string;
  imagem_url: string;
  preco_atual: number;
  preco_alvo: number;
  menor_preco: number;
  ativo: number;
  status: "monitorando" | "alvo_atingido" | "erro";
  ultimo_check: string;
  criado_em: string;
}

export interface AutomacaoLog {
  id: string;
  ofertas_coletadas: number;
  monitores_checados: number;
  alertas_disparados: number;
  envios_feitos: number;
  detalhe: string;
  criado_em: string;
}

export interface ConfigAutomacao {
  ativo: boolean;
  intervalo_minutos: number;
  disparar_aprovadas: boolean;
  coletar_rss: boolean;
  checar_monitores: boolean;
  ultimo_ciclo: string;
}

let inicializadoV4 = false;

export function getDbV4() {
  const db = getDbV3();
  if (inicializadoV4) return db;

  db.exec(`
    CREATE TABLE IF NOT EXISTS monitores_preco (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      url TEXT NOT NULL,
      loja TEXT NOT NULL DEFAULT 'outra',
      imagem_url TEXT NOT NULL DEFAULT '',
      preco_atual REAL NOT NULL DEFAULT 0,
      preco_alvo REAL NOT NULL DEFAULT 0,
      menor_preco REAL NOT NULL DEFAULT 0,
      ativo INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'monitorando',
      ultimo_check TEXT NOT NULL DEFAULT '',
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automacao_log (
      id TEXT PRIMARY KEY,
      ofertas_coletadas INTEGER NOT NULL DEFAULT 0,
      monitores_checados INTEGER NOT NULL DEFAULT 0,
      alertas_disparados INTEGER NOT NULL DEFAULT 0,
      envios_feitos INTEGER NOT NULL DEFAULT 0,
      detalhe TEXT NOT NULL DEFAULT '',
      criado_em TEXT NOT NULL
    );
  `);

  try {
    db.exec("ALTER TABLE ofertas ADD COLUMN origem_label TEXT NOT NULL DEFAULT ''");
  } catch {
    /* coluna ja existe */
  }
  db.exec("UPDATE ofertas SET origem_label = 'Exemplo' WHERE exemplo = 1 AND origem_label = ''");
  seedV4(db);
  inicializadoV4 = true;
  return db;
}

function seedV4(db: ReturnType<typeof getDbV3>) {
  // Instalacao limpa: remove os monitores ficticios de demonstracao
  db.prepare("DELETE FROM monitores_preco WHERE id LIKE 'mon_demo%'").run();
}

export function getConfigAutomacao(): ConfigAutomacao {
  getDbV4();
  return {
    ativo: lerCfg("auto_ativo", "false") === "true",
    intervalo_minutos: Math.max(1, Number(lerCfg("auto_intervalo_min", "5")) || 5),
    disparar_aprovadas: lerCfg("auto_disparar_aprovadas", "false") === "true",
    coletar_rss: lerCfg("auto_coletar_rss", "true") !== "false",
    checar_monitores: lerCfg("auto_checar_monitores", "true") !== "false",
    ultimo_ciclo: lerCfg("auto_ultimo_ciclo", ""),
  };
}

export function salvarConfigAutomacao(parcial: Partial<ConfigAutomacao>): ConfigAutomacao {
  getDbV4();
  if (parcial.ativo !== undefined) gravarCfg("auto_ativo", String(Boolean(parcial.ativo)));
  if (parcial.intervalo_minutos !== undefined) {
    gravarCfg("auto_intervalo_min", String(Math.max(1, Math.min(240, Number(parcial.intervalo_minutos) || 5))));
  }
  if (parcial.disparar_aprovadas !== undefined) {
    gravarCfg("auto_disparar_aprovadas", String(Boolean(parcial.disparar_aprovadas)));
  }
  if (parcial.coletar_rss !== undefined) gravarCfg("auto_coletar_rss", String(Boolean(parcial.coletar_rss)));
  if (parcial.checar_monitores !== undefined) {
    gravarCfg("auto_checar_monitores", String(Boolean(parcial.checar_monitores)));
  }
  if (parcial.ultimo_ciclo !== undefined) gravarCfg("auto_ultimo_ciclo", parcial.ultimo_ciclo);
  return getConfigAutomacao();
}

export function registrarLogAutomacao(dados: Omit<AutomacaoLog, "id" | "criado_em">) {
  const db = getDbV4();
  const agora = new Date().toISOString();
  db.prepare(`
    INSERT INTO automacao_log
      (id, ofertas_coletadas, monitores_checados, alertas_disparados, envios_feitos, detalhe, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    gerarId("aut"),
    dados.ofertas_coletadas,
    dados.monitores_checados,
    dados.alertas_disparados,
    dados.envios_feitos,
    dados.detalhe,
    agora
  );
  gravarCfg("auto_ultimo_ciclo", agora);
}
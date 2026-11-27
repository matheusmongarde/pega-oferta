/**
 * Servico local de WhatsApp do pega-oferta (Baileys por QR Code) - v3.0 Multi-Instancia
 *
 * - Suporta multiplas contas/numeros de WhatsApp simultaneos ("principal" em .sessao/, extras em .sessao-<id>/)
 * - Cache de grupos em memoria por instancia (TTL 5 min + pre-aquecimento ao conectar) -> abertura instantanea!
 * - Persiste grupos espelhados em .espelho.json e registro de instancias em .instancias.json
 * - GET  /status           -> estado da principal + lista completa de instancias
 * - GET  /grupos           -> lista grupos em cache (?instancia=principal|todas|<id>&forcar=1)
 * - GET  /convite?jid=...  -> gera/le link de convite do grupo (se admin)
 * - POST /conectar         -> conecta instancia existente ou cria nova ({ nova: true, nome })
 * - POST /desconectar      -> encerra sessao de uma instancia ({ instancia })
 * - POST /espelho          -> salva lista de grupos espelhados
 * - POST /enviar           -> envia texto (ou foto + legenda) pela instancia escolhida
 */
import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidGroup,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";

const HOST = process.env.WHATSAPP_HOST || "127.0.0.1";
const PORT = Number(process.env.WHATSAPP_PORT) || 4320;
const TOKEN = process.env.WHATSAPP_TOKEN || "";
const APP_URL = (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const ESPELHO_FILE = path.resolve(process.cwd(), ".espelho.json");
const INSTANCIAS_FILE = path.resolve(process.cwd(), ".instancias.json");
const CACHE_GRUPOS_TTL_MS = 5 * 60_000;

type Estado = "desconectado" | "aguardando_qr" | "reconectando" | "conectado";

interface GrupoInfo {
  jid: string;
  nome: string;
  participantes: number;
  espelhando: boolean;
  souAdmin: boolean;
  instancia: string;
  instancia_nome: string;
  numero: string | null;
}

interface InstanciaWa {
  id: string;
  nome: string;
  sessaoDir: string;
  sock: WASocket | null;
  estado: Estado;
  qrDataUrl: string | null;
  numero: string | null;
  iniciando: boolean;
  gruposCache: GrupoInfo[];
  gruposCacheEm: number;
  buscandoGrupos: Promise<GrupoInfo[]> | null;
}

interface MsgCache {
  id: string;
  jid: string;
  texto: string;
  timestampMs: number;
}

const logger = pino({ level: "silent" });
const instancias = new Map<string, InstanciaWa>();
const enviadosIds = new Set<string>();
const processadosIds = new Set<string>();
const nomesGrupos = new Map<string, string>();
const historicoGrupos = new Map<string, MsgCache[]>();

function dirDaInstancia(id: string): string {
  return id === "principal"
    ? path.resolve(process.cwd(), ".sessao")
    : path.resolve(process.cwd(), `.sessao-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`);
}

function criarRegistroInstancia(id: string, nome?: string): InstanciaWa {
  const existente = instancias.get(id);
  if (existente) {
    if (nome?.trim()) existente.nome = nome.trim();
    return existente;
  }
  const inst: InstanciaWa = {
    id,
    nome: nome?.trim() || (id === "principal" ? "WhatsApp Principal" : `WhatsApp ${instancias.size + 1}`),
    sessaoDir: dirDaInstancia(id),
    sock: null,
    estado: "desconectado",
    qrDataUrl: null,
    numero: null,
    iniciando: false,
    gruposCache: [],
    gruposCacheEm: 0,
    buscandoGrupos: null,
  };
  instancias.set(id, inst);
  return inst;
}

function carregarInstanciasSalvas() {
  criarRegistroInstancia("principal", "WhatsApp Principal");
  try {
    if (fsSync.existsSync(INSTANCIAS_FILE)) {
      const parsed = JSON.parse(fsSync.readFileSync(INSTANCIAS_FILE, "utf8")) as Array<{
        id: string;
        nome: string;
      }>;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item?.id) criarRegistroInstancia(item.id, item.nome);
        }
      }
    }
  } catch {
    /* ignora arquivo corrompido */
  }
}

async function salvarInstancias() {
  const lista = Array.from(instancias.values()).map((i) => ({ id: i.id, nome: i.nome }));
  await fs.writeFile(INSTANCIAS_FILE, JSON.stringify(lista, null, 2), "utf8");
}

function guardarNoHistorico(item: MsgCache) {
  const lista = historicoGrupos.get(item.jid) || [];
  if (lista.some((x) => x.id === item.id)) return;
  lista.push(item);
  if (lista.length > 200) lista.splice(0, lista.length - 200);
  historicoGrupos.set(item.jid, lista);
}

function extrairTextoMsg(msg: { message?: Record<string, unknown> | null }): string {
  const m = msg.message as
    | {
        conversation?: string;
        extendedTextMessage?: { text?: string };
        imageMessage?: { caption?: string };
        videoMessage?: { caption?: string };
      }
    | null
    | undefined;
  return (
    m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    ""
  ).trim();
}

function extrairTimestampMs(raw: unknown): number {
  if (typeof raw === "number" && raw > 0) return raw > 1e12 ? raw : raw * 1000;
  if (typeof raw === "bigint") {
    const n = Number(raw);
    return n > 1e12 ? n : n * 1000;
  }
  if (raw && typeof raw === "object" && "low" in (raw as Record<string, unknown>)) {
    const n = Number((raw as { low: number }).low);
    return n > 0 ? n * 1000 : Date.now();
  }
  return Date.now();
}

function detectarLojaRapida(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes("amazon") || t.includes("amzn")) return "amazon";
  if (t.includes("mercado livre") || t.includes("mercadolivre") || t.includes("meli") || /\bml\b/.test(t))
    return "mercadolivre";
  if (t.includes("shopee") || t.includes("shope.ee")) return "shopee";
  if (t.includes("aliexpress")) return "aliexpress";
  if (t.includes("magalu") || t.includes("kabum")) return "awin";
  return "";
}

async function processarMensagemGrupoEspelhado(item: MsgCache) {
  if (processadosIds.has(item.id)) return;
  processadosIds.add(item.id);

  const nomeGrupo = nomesGrupos.get(item.jid) || item.jid;
  const origemLabel = `WhatsApp · ${nomeGrupo}`;
  const texto = item.texto;
  const criadoEm = new Date(item.timestampMs).toISOString();

  const pareceExpirado = /(?:esgotou|acabou|expirou|encerrad[oa]|j[aá]\s+era|sem\s+estoque|n[aã]o\s+funciona\s+mais)/i.test(texto);
  const pareceAcabando = /(?:acabando|[uú]ltimas?\s+unidades?|pouco\s+estoque|quase\s+acabando|corra\s+que\s+acaba)/i.test(texto);
  if (pareceExpirado || pareceAcabando) {
    fetch(`${APP_URL}/api/cupons/status-auto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texto,
        status: pareceExpirado ? "expirado" : "acabando",
        loja: detectarLojaRapida(texto),
      }),
    }).catch(() => {});
  }

  const temLink = /https?:\/\//i.test(texto);
  const temPistaCupom =
    /(?:cupom|cupons|c[oó]digo|desconto|off\b|meli|shopee|amazon|aliexpress)/i.test(texto) ||
    /\b[A-Z]{3,}[0-9]{1,}[A-Z0-9]*\b/.test(texto);

  if (temLink) {
    await fetch(`${APP_URL}/api/v1/ofertas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pega-interno": "1",
      },
      body: JSON.stringify({
        texto,
        disparar: false,
        origem_label: origemLabel,
        criado_em: criadoEm,
      }),
    }).catch(() => {});
  }

  if (temPistaCupom) {
    await fetch(`${APP_URL}/api/cupons/capturar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texto,
        origem_label: origemLabel,
      }),
    }).catch(() => {});
  }
}

async function importarHistoricoGrupo(jid: string): Promise<number> {
  const lista = historicoGrupos.get(jid) || [];
  let importadas = 0;
  for (const item of lista) {
    if (processadosIds.has(item.id)) continue;
    await processarMensagemGrupoEspelhado(item);
    importadas++;
  }
  return importadas;
}

function carregarEspelho(): Set<string> {
  const set = new Set<string>(
    (process.env.ESPELHO_GRUPOS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  try {
    if (fsSync.existsSync(ESPELHO_FILE)) {
      const parsed = JSON.parse(fsSync.readFileSync(ESPELHO_FILE, "utf8")) as string[];
      if (Array.isArray(parsed)) {
        for (const j of parsed) if (typeof j === "string" && j.trim()) set.add(j.trim());
      }
    }
  } catch {
    /* ignora arquivo corrompido */
  }
  return set;
}

const gruposEspelhados = carregarEspelho();

async function salvarEspelho() {
  await fs.writeFile(ESPELHO_FILE, JSON.stringify([...gruposEspelhados], null, 2), "utf8");
}

function normalizarNumero(id?: string | null): string {
  if (!id) return "";
  return id.split(":")[0]!.split("@")[0]!.replace(/\D/g, "");
}

function mesmoNumero(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith("55") && b.startsWith("55") && a.slice(0, 4) === b.slice(0, 4)) {
    return a.slice(-8) === b.slice(-8);
  }
  return false;
}

async function atualizarCacheGrupos(inst: InstanciaWa, forcar = false): Promise<GrupoInfo[]> {
  if (!inst.sock || inst.estado !== "conectado") {
    return inst.gruposCache;
  }
  const agora = Date.now();
  if (!forcar && inst.gruposCache.length > 0 && agora - inst.gruposCacheEm < CACHE_GRUPOS_TTL_MS) {
    return inst.gruposCache.map((g) => ({ ...g, espelhando: gruposEspelhados.has(g.jid) }));
  }
  if (inst.buscandoGrupos) {
    return inst.buscandoGrupos;
  }

  const sockAtual = inst.sock;
  inst.buscandoGrupos = (async () => {
    try {
      const mapa = await sockAtual.groupFetchAllParticipating();
      const meuNum = normalizarNumero(sockAtual.user?.id);
      const meuLid = normalizarNumero((sockAtual.user as { lid?: string } | undefined)?.lid);

      const grupos: GrupoInfo[] = Object.values(mapa)
        .map((g) => {
          if (g.id && g.subject) nomesGrupos.set(g.id, g.subject);
          const ownerNum = normalizarNumero(g.owner);
          const ownerPn = normalizarNumero((g as { ownerPn?: string }).ownerPn);
          const souAdmin =
            mesmoNumero(meuNum, ownerNum) ||
            mesmoNumero(meuNum, ownerPn) ||
            (meuLid && ownerNum === meuLid) ||
            (g.participants || []).some((p) => {
              const pObj = p as {
                id?: string;
                jid?: string;
                lid?: string;
                phoneNumber?: string;
                admin?: string | null;
              };
              const candidatos = [
                normalizarNumero(pObj.id),
                normalizarNumero(pObj.jid),
                normalizarNumero(pObj.lid),
                normalizarNumero(pObj.phoneNumber),
              ].filter(Boolean);
              const bate = candidatos.some(
                (c) => mesmoNumero(meuNum, c) || (meuLid && c === meuLid)
              );
              return bate && (p.admin === "admin" || p.admin === "superadmin");
            });

          return {
            jid: g.id,
            nome: g.subject || g.id,
            participantes: g.participants?.length ?? 0,
            espelhando: gruposEspelhados.has(g.id),
            souAdmin: Boolean(souAdmin),
            instancia: inst.id,
            instancia_nome: inst.nome,
            numero: inst.numero,
          };
        })
        .sort((a, b) => Number(b.souAdmin) - Number(a.souAdmin) || b.participantes - a.participantes);

      inst.gruposCache = grupos;
      inst.gruposCacheEm = Date.now();
      return grupos;
    } catch {
      return inst.gruposCache;
    } finally {
      inst.buscandoGrupos = null;
    }
  })();

  return inst.buscandoGrupos;
}

async function conectarInstancia(id = "principal", nome?: string) {
  const inst = criarRegistroInstancia(id, nome);
  await salvarInstancias();
  if (inst.iniciando || (inst.sock && inst.estado !== "desconectado")) return inst;
  inst.iniciando = true;
  try {
    await fs.mkdir(inst.sessaoDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(inst.sessaoDir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

    const s = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      logger,
      browser: Browsers.macOS(`pega-oferta-${inst.id}`),
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });
    inst.sock = s;
    inst.estado = "reconectando";

    s.ev.on("creds.update", saveCreds);

    s.ev.on("connection.update", async (u) => {
      if (inst.sock !== s) return;
      if (u.qr) {
        inst.estado = "aguardando_qr";
        inst.qrDataUrl = await QRCode.toDataURL(u.qr, { margin: 1, width: 320 }).catch(() => null);
      }
      if (u.connection === "open") {
        inst.estado = "conectado";
        inst.qrDataUrl = null;
        inst.numero = normalizarNumero(s.user?.id) || null;
        console.log(`[whatsapp:${inst.id}] conectado: ${inst.numero ?? "ok"}`);
        // Pre-aquece o cache de grupos assim que conecta (zero espera na UI!)
        atualizarCacheGrupos(inst, true).catch(() => {});
      }
      if (u.connection === "close") {
        const code = (u.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
          ?.output?.statusCode;
        inst.sock = null;
        if (code === DisconnectReason.loggedOut || code === DisconnectReason.badSession) {
          await fs.rm(inst.sessaoDir, { recursive: true, force: true });
          inst.estado = "desconectado";
          inst.qrDataUrl = null;
          inst.numero = null;
          inst.gruposCache = [];
          return;
        }
        inst.estado = "desconectado";
        inst.qrDataUrl = null;
        if (fsSync.existsSync(path.join(inst.sessaoDir, "creds.json"))) {
          setTimeout(() => conectarInstancia(inst.id).catch(() => {}), 4000);
        }
      }
    });

    s.ev.on("messaging-history.set", async ({ messages }) => {
      for (const msg of messages || []) {
        const msgId = msg.key?.id;
        const jid = msg.key?.remoteJid || "";
        if (!msgId || !isJidGroup(jid) || enviadosIds.has(msgId)) continue;
        const texto = extrairTextoMsg(msg as { message?: Record<string, unknown> | null });
        if (!texto) continue;
        const item: MsgCache = {
          id: msgId,
          jid,
          texto,
          timestampMs: extrairTimestampMs(msg.messageTimestamp),
        };
        guardarNoHistorico(item);
        if (gruposEspelhados.has(jid)) {
          processarMensagemGrupoEspelhado(item).catch(() => {});
        }
      }
    });

    s.ev.on("messages.upsert", async ({ messages, type }) => {
      for (const msg of messages) {
        const msgId = msg.key.id;
        if (!msgId || enviadosIds.has(msgId)) continue;
        const jid = msg.key.remoteJid || "";
        const texto = extrairTextoMsg(msg as { message?: Record<string, unknown> | null });
        if (!texto) continue;

        if (!isJidGroup(jid)) {
          if (type !== "notify" || msg.key.fromMe) continue;
          if (/(?:quero|procurando|me\s*avisa|avisa\s*quando|alerta\s*de|buscando)/i.test(texto)) {
            const telefone = normalizarNumero(jid);
            if (telefone) {
              fetch(`${APP_URL}/api/crm/auto`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  telefone,
                  nome: msg.pushName || "",
                  texto,
                }),
              }).catch(() => {});
            }
          }
          continue;
        }

        const item: MsgCache = {
          id: msgId,
          jid,
          texto,
          timestampMs: extrairTimestampMs(msg.messageTimestamp),
        };
        guardarNoHistorico(item);
        if (gruposEspelhados.has(jid)) {
          processarMensagemGrupoEspelhado(item).catch(() => {});
        }
      }
    });
  } finally {
    inst.iniciando = false;
  }
  return inst;
}

function resumirInstancia(i: InstanciaWa) {
  return {
    id: i.id,
    nome: i.nome,
    estado: i.estado,
    qr: i.qrDataUrl,
    numero: i.numero,
    grupos_count: i.gruposCache.length,
  };
}

function resolverInstanciaParaEnvio(idDesejado?: string): InstanciaWa | undefined {
  if (idDesejado && instancias.has(idDesejado)) {
    const chosen = instancias.get(idDesejado)!;
    if (chosen.sock && chosen.estado === "conectado") return chosen;
  }
  const principal = instancias.get("principal");
  if (principal?.sock && principal.estado === "conectado") return principal;
  return Array.from(instancias.values()).find((i) => i.sock && i.estado === "conectado");
}

async function lerJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

function responder(res: http.ServerResponse, status: number, dados: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(dados));
}

const server = http.createServer(async (req, res) => {
  if (TOKEN && req.headers["x-whatsapp-token"] !== TOKEN) {
    return responder(res, 401, { erro: "Token invalido." });
  }

  const urlObj = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const rota = urlObj.pathname;

  try {
    if (req.method === "GET" && rota === "/status") {
      const principal = instancias.get("principal") || criarRegistroInstancia("principal");
      const primeiraConectada = resolverInstanciaParaEnvio();
      return responder(res, 200, {
        estado: primeiraConectada?.estado || principal.estado,
        qr: principal.qrDataUrl,
        numero: primeiraConectada?.numero || principal.numero,
        grupos_espelhados: [...gruposEspelhados],
        instancias: Array.from(instancias.values()).map(resumirInstancia),
      });
    }

    if (req.method === "POST" && rota === "/conectar") {
      const body = await lerJson(req);
      let id = String(body.instancia || "").trim();
      const nome = String(body.nome || "").trim();
      if (body.nova === true || !id) {
        id = body.nova === true ? `wa_${Date.now().toString(36)}` : "principal";
      }
      const inst = await conectarInstancia(id, nome || undefined);
      return responder(res, 200, {
        ok: true,
        instancia: resumirInstancia(inst),
        estado: inst.estado,
        qr: inst.qrDataUrl,
      });
    }

    if (req.method === "POST" && rota === "/desconectar") {
      const body = await lerJson(req);
      const id = String(body.instancia || "principal").trim() || "principal";
      const inst = instancias.get(id);
      if (inst) {
        if (inst.sock) {
          await inst.sock.logout().catch(() => {});
          inst.sock = null;
        }
        await fs.rm(inst.sessaoDir, { recursive: true, force: true });
        inst.estado = "desconectado";
        inst.qrDataUrl = null;
        inst.numero = null;
        inst.gruposCache = [];
        inst.gruposCacheEm = 0;
        if (id !== "principal") {
          instancias.delete(id);
          await salvarInstancias();
        }
      }
      return responder(res, 200, { ok: true, instancia: id });
    }

    if (req.method === "GET" && rota === "/grupos") {
      const instParam = (urlObj.searchParams.get("instancia") || "").trim();
      const forcar = urlObj.searchParams.get("forcar") === "1";

      if (instParam && instParam !== "todas") {
        const inst = instancias.get(instParam);
        if (!inst || !inst.sock || inst.estado !== "conectado") {
          return responder(res, 200, { grupos: [] });
        }
        const grupos = await atualizarCacheGrupos(inst, forcar);
        return responder(res, 200, { grupos });
      }

      // Sem parametro ou "todas": junta grupos de todas as instancias conectadas (principal primeiro)
      const conectadas = Array.from(instancias.values()).filter(
        (i) => i.sock && i.estado === "conectado"
      );
      if (conectadas.length === 0) {
        return responder(res, 200, { grupos: [] });
      }
      const listas = await Promise.all(conectadas.map((i) => atualizarCacheGrupos(i, forcar)));
      const vistos = new Set<string>();
      const grupos: GrupoInfo[] = [];
      for (const lista of listas) {
        for (const g of lista) {
          const chave = instParam === "todas" ? `${g.instancia}::${g.jid}` : g.jid;
          if (vistos.has(chave)) continue;
          vistos.add(chave);
          grupos.push(g);
        }
      }
      return responder(res, 200, { grupos });
    }

    if (req.method === "GET" && rota === "/convite") {
      const jid = urlObj.searchParams.get("jid") || "";
      const instParam = urlObj.searchParams.get("instancia") || undefined;
      const inst = resolverInstanciaParaEnvio(instParam);
      if (!inst?.sock || !jid) {
        return responder(res, 400, { erro: "WhatsApp desconectado ou JID invalido." });
      }
      try {
        const codigo = await inst.sock.groupInviteCode(jid);
        return responder(res, 200, {
          ok: true,
          link: codigo ? `https://chat.whatsapp.com/${codigo}` : "",
        });
      } catch (e) {
        return responder(res, 403, {
          erro: e instanceof Error ? e.message : "Sem permissao de admin para gerar link de convite.",
        });
      }
    }

    if (req.method === "POST" && rota === "/espelho") {
      const body = await lerJson(req);
      const lista = Array.isArray(body.grupos) ? (body.grupos as string[]) : [];
      const anteriores = new Set(gruposEspelhados);
      gruposEspelhados.clear();
      for (const jid of lista) if (typeof jid === "string" && jid.trim()) gruposEspelhados.add(jid.trim());
      await salvarEspelho();
      let importadasHistorico = 0;
      for (const jid of gruposEspelhados) {
        if (!anteriores.has(jid)) {
          importadasHistorico += await importarHistoricoGrupo(jid);
        }
      }
      return responder(res, 200, {
        ok: true,
        grupos_espelhados: [...gruposEspelhados],
        importadas_historico: importadasHistorico,
      });
    }

    if (req.method === "POST" && rota === "/enviar") {
      const body = await lerJson(req);
      const instParam = String(body.instancia || "").trim() || undefined;
      const inst = resolverInstanciaParaEnvio(instParam);
      if (!inst?.sock) {
        return responder(res, 503, { erro: "WhatsApp desconectado. Escaneie o QR Code em Conexoes." });
      }
      const destinoRaw = String(body.destino || "").trim();
      const texto = String(body.texto || "").trim();
      const imagemUrl = String(body.imagem_url || "").trim();
      const imagemBase64 = String(body.imagem_base64 || "").trim();
      if (!destinoRaw || !texto) {
        return responder(res, 400, { erro: "Informe destino e texto." });
      }
      const jid = destinoRaw.includes("@")
        ? destinoRaw
        : `${destinoRaw.replace(/\D/g, "")}@s.whatsapp.net`;

      let sent;
      if (imagemBase64) {
        try {
          const limpo = imagemBase64.replace(/^data:image\/\w+;base64,/, "");
          const buf = Buffer.from(limpo, "base64");
          sent = await inst.sock.sendMessage(jid, { image: buf, caption: texto });
        } catch {
          sent = await inst.sock.sendMessage(jid, { text: texto });
        }
      } else if (imagemUrl && /^https?:\/\//i.test(imagemUrl)) {
        try {
          sent = await inst.sock.sendMessage(jid, { image: { url: imagemUrl }, caption: texto });
        } catch {
          sent = await inst.sock.sendMessage(jid, { text: texto });
        }
      } else {
        sent = await inst.sock.sendMessage(jid, { text: texto });
      }
      if (sent?.key?.id) enviadosIds.add(sent.key.id);
      return responder(res, 200, { ok: true, id: sent?.key?.id || null, instancia: inst.id });
    }

    responder(res, 404, { erro: "Rota nao encontrada." });
  } catch (err) {
    responder(res, 500, { erro: err instanceof Error ? err.message : "Erro interno" });
  }
});

carregarInstanciasSalvas();

server.listen(PORT, HOST, () => {
  console.log(`[pega-oferta/whatsapp] ouvindo em http://${HOST}:${PORT} (multi-instancia)`);
  for (const inst of instancias.values()) {
    if (fsSync.existsSync(path.join(inst.sessaoDir, "creds.json"))) {
      console.log(`[whatsapp:${inst.id}] sessao encontrada, reconectando automaticamente...`);
      conectarInstancia(inst.id).catch(() => {});
    }
  }
});

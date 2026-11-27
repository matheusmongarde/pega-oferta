import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const filhos = [];

function subir(nome, comando, args, cwd) {
  const proc = spawn(comando, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  proc.on("exit", (code) => {
    console.log(`[${nome}] encerrado (codigo ${code ?? 0})`);
  });
  filhos.push(proc);
}

const raiz = process.cwd();
const waDir = path.join(raiz, "servicos", "whatsapp");
const appUrl = (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

console.log("[tudo] Subindo pega-oferta (Web + WhatsApp QR + Coletor 20s + Piloto Automatico)...");
subir("web", "npm", ["run", "dev"], raiz);

if (fs.existsSync(path.join(waDir, "node_modules"))) {
  subir("whatsapp", "npm", ["start"], waDir);
} else {
  console.log("[tudo] servicos/whatsapp nao instalado. Rode: cd servicos/whatsapp && npm install");
}

// Coletor continuo de todas as fontes ativas a cada 20 segundos (sem duplicar)
let coletandoFontes = false;
async function rodarColetorContinuo() {
  if (coletandoFontes) return;
  coletandoFontes = true;
  try {
    const res = await fetch(`${appUrl}/api/fontes/coletar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ automatico: true }),
    });
    if (!res.ok) return;
    const out = await res.json().catch(() => ({}));
    if (out?.novas > 0) {
      console.log(`[coletor-20s] +${out.novas} novas ofertas (${out.duplicadas || 0} duplicadas barradas)`);
    }
  } catch {
    /* servidor ainda subindo */
  } finally {
    coletandoFontes = false;
  }
}

const inicioColetor = setTimeout(() => {
  rodarColetorContinuo();
}, 6_000);

const timerColetor = setInterval(() => {
  rodarColetorContinuo();
}, 20_000);

// Worker leve do Piloto Automatico: consulta a config a cada 30s e executa disparos/monitores no intervalo configurado
let ultimoDisparo = 0;
let rodando = false;
const timerPiloto = setInterval(async () => {
  if (rodando) return;
  try {
    const res = await fetch(`${appUrl}/api/automacao`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.config?.ativo) return;
    const intervaloMs = Math.max(1, Number(data.config.intervalo_minutos) || 5) * 60_000;
    if (Date.now() - ultimoDisparo < intervaloMs) return;
    rodando = true;
    ultimoDisparo = Date.now();
    const run = await fetch(`${appUrl}/api/automacao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forcar: false }),
    });
    const out = await run.json().catch(() => ({}));
    if (out?.executado) {
      console.log(`[piloto] Ciclo concluido: ${out.detalhe}`);
    }
  } catch {
    /* servidor ainda subindo */
  } finally {
    rodando = false;
  }
}, 30_000);

function encerrar() {
  clearTimeout(inicioColetor);
  clearInterval(timerColetor);
  clearInterval(timerPiloto);
  for (const p of filhos) {
    try {
      p.kill();
    } catch {
      /* ja encerrado */
    }
  }
  process.exit(0);
}

process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
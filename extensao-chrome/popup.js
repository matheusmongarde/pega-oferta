let urlAtual = "";
let imagemAtual = "";

async function lerPagina() {
  const saved = await chrome.storage.local.get(["servidor"]);
  if (saved.servidor) document.getElementById("servidor").value = saved.servidor;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  urlAtual = tab.url || "";

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const ogImg =
        document.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
        document.querySelector('img#landingImage')?.getAttribute("src") ||
        document.querySelector("img.ui-pdp-image")?.getAttribute("src") ||
        "";
      const ogTitle =
        document.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
        document.querySelector("h1")?.textContent?.trim() ||
        document.title ||
        "";
      const metaPrice =
        document.querySelector('meta[property="product:price:amount"]')?.getAttribute("content") ||
        document.querySelector('meta[itemprop="price"]')?.getAttribute("content") ||
        "";
      let preco = metaPrice;
      if (!preco) {
        const m = document.body.innerText.match(/R\$\s*([\d.]+,\d{2})/);
        if (m) preco = m[1];
      }
      return { titulo: ogTitle.trim(), imagem: ogImg, preco };
    },
  });

  if (result) {
    imagemAtual = result.imagem || "";
    document.getElementById("titulo").value = result.titulo || "";
    document.getElementById("preco").value = result.preco || "";
    document.getElementById("tituloPreview").textContent = result.titulo || urlAtual;
    document.getElementById("precoPreview").textContent = result.preco ? `R$ ${result.preco}` : "Preco nao detectado";
    if (imagemAtual) document.getElementById("foto").src = imagemAtual;
  }
}

async function enviar(disparar) {
  const status = document.getElementById("status");
  const servidor = document.getElementById("servidor").value.replace(/\/+$/, "");
  await chrome.storage.local.set({ servidor });

  const titulo = document.getElementById("titulo").value.trim();
  const preco = document.getElementById("preco").value.trim();
  const cupom = document.getElementById("cupom").value.trim().toUpperCase();

  const partes = [titulo];
  if (preco) partes.push(`Por R$ ${preco}`);
  if (cupom) partes.push(`Cupom: ${cupom}`);
  partes.push(urlAtual);

  status.className = "status";
  status.textContent = "Enviando pro pega-oferta...";

  try {
    const res = await fetch(`${servidor}/api/v1/ofertas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: partes.join("\n"), disparar, imagem_url: imagemAtual }),
    });
    const data = await res.json();
    if (!res.ok) {
      status.className = "status err";
      status.textContent = data.erro || `Erro HTTP ${res.status}`;
      return;
    }
    status.className = "status ok";
    status.textContent = disparar ? "Salvo e disparado com sua tag!" : "Salvo no catalogo com sua tag!";
  } catch (e) {
    status.className = "status err";
    status.textContent = "Nao alcancou o servidor local. O pega-oferta esta rodando?";
  }
}

document.getElementById("btnSalvar").addEventListener("click", () => enviar(false));
document.getElementById("btnDisparar").addEventListener("click", () => enviar(true));
lerPagina();
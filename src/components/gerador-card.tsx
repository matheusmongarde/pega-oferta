"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";

interface OfertaCard {
  id: string;
  titulo: string;
  loja: string;
  preco: number;
  preco_antigo: number | null;
  desconto_pct: number | null;
  cupom: string;
}

const NOMES_LOJAS: Record<string, string> = {
  amazon: "AMAZON",
  mercadolivre: "MERCADO LIVRE",
  shopee: "SHOPEE",
  aliexpress: "ALIEXPRESS",
  awin: "AWIN",
  outra: "OFERTA VERIFICADA",
};

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function quebrarLinhas(ctx: CanvasRenderingContext2D, texto: string, maxWidth: number): string[] {
  const palavras = texto.split(" ");
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(teste).width > maxWidth && atual) {
      linhas.push(atual);
      atual = p;
    } else {
      atual = teste;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.slice(0, 4);
}

export function GeradorCardModal({
  oferta,
  arrobaInicial,
  logoInicial,
  onClose,
}: {
  oferta: OfertaCard;
  arrobaInicial: string;
  logoInicial: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [escuro, setEscuro] = useState(true);
  const [arroba, setArroba] = useState(arrobaInicial || "@pegaoferta");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080;
    const H = 1920;
    canvas.width = W;
    canvas.height = H;

    const desenhar = (imgLogo?: HTMLImageElement) => {
      // Fundo
      ctx.fillStyle = escuro ? "#0d0f12" : "#f5f6f8";
      ctx.fillRect(0, 0, W, H);

      // Hachura diagonal sutil no topo
      ctx.save();
      ctx.strokeStyle = escuro ? "rgba(255,255,255,0.05)" : "rgba(15,20,25,0.06)";
      ctx.lineWidth = 2;
      for (let i = -H; i < W + H; i += 28) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i - 600, 600);
        ctx.stroke();
      }
      ctx.restore();

      // Card central
      const cardX = 80;
      const cardY = 260;
      const cardW = W - 160;
      const cardH = 1360;

      ctx.fillStyle = escuro ? "#15181d" : "#ffffff";
      ctx.strokeStyle = escuro ? "#262b33" : "#e3e6eb";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 48);
      ctx.fill();
      ctx.stroke();

      // Logo + @ no topo do card
      let topY = cardY + 90;
      if (imgLogo) {
        const size = 92;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX + 70, topY - 46, size, size, 22);
        ctx.clip();
        ctx.drawImage(imgLogo, cardX + 70, topY - 46, size, size);
        ctx.restore();
        ctx.fillStyle = escuro ? "#eceef2" : "#0f1419";
        ctx.font = "700 38px sans-serif";
        ctx.fillText(arroba, cardX + 184, topY + 12);
      } else {
        ctx.fillStyle = escuro ? "#eceef2" : "#0f1419";
        ctx.font = "700 40px sans-serif";
        ctx.fillText(arroba, cardX + 70, topY + 12);
      }

      // Badge da loja
      const lojaTxt = NOMES_LOJAS[oferta.loja] || "OFERTA";
      ctx.fillStyle = escuro ? "#18203a" : "#edf1fd";
      ctx.beginPath();
      ctx.roundRect(cardX + 70, cardY + 210, 320, 62, 31);
      ctx.fill();
      ctx.fillStyle = escuro ? "#8ea6ff" : "#3e63dd";
      ctx.font = "700 26px monospace";
      ctx.fillText(lojaTxt, cardX + 105, cardY + 250);

      // Badge de desconto
      if (oferta.desconto_pct) {
        ctx.fillStyle = escuro ? "#13251a" : "#e7f5ec";
        ctx.beginPath();
        ctx.roundRect(cardX + 410, cardY + 210, 210, 62, 31);
        ctx.fill();
        ctx.fillStyle = escuro ? "#4ade80" : "#15803d";
        ctx.font = "700 28px monospace";
        ctx.fillText(`-${oferta.desconto_pct}% OFF`, cardX + 442, cardY + 250);
      }

      // Titulo do produto
      ctx.fillStyle = escuro ? "#eceef2" : "#0f1419";
      ctx.font = "700 58px sans-serif";
      const linhas = quebrarLinhas(ctx, oferta.titulo, cardW - 140);
      linhas.forEach((l, idx) => {
        ctx.fillText(l, cardX + 70, cardY + 370 + idx * 78);
      });

      // Preco antigo riscado
      const precoBaseY = cardY + 780;
      if (oferta.preco_antigo && oferta.preco_antigo > oferta.preco) {
        const antigoTxt = `De ${brl(oferta.preco_antigo)}`;
        ctx.fillStyle = escuro ? "#858c98" : "#6b7280";
        ctx.font = "500 42px monospace";
        ctx.fillText(antigoTxt, cardX + 70, precoBaseY);
        const wAntigo = ctx.measureText(antigoTxt).width;
        ctx.strokeStyle = escuro ? "#858c98" : "#6b7280";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cardX + 70, precoBaseY - 14);
        ctx.lineTo(cardX + 70 + wAntigo, precoBaseY - 14);
        ctx.stroke();
      }

      // Preco novo gigante
      ctx.fillStyle = escuro ? "#4ade80" : "#15803d";
      ctx.font = "800 128px sans-serif";
      ctx.fillText(oferta.preco > 0 ? brl(oferta.preco) : "VER PRECO", cardX + 70, precoBaseY + 145);

      // Cupom em destaque
      if (oferta.cupom) {
        ctx.fillStyle = escuro ? "#1b1f25" : "#eef0f3";
        ctx.strokeStyle = escuro ? "#363c46" : "#cdd2da";
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 10]);
        ctx.beginPath();
        ctx.roundRect(cardX + 70, precoBaseY + 210, cardW - 140, 128, 26);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = escuro ? "#858c98" : "#6b7280";
        ctx.font = "600 24px monospace";
        ctx.fillText("USE O CUPOM", cardX + 110, precoBaseY + 258);

        ctx.fillStyle = escuro ? "#eceef2" : "#0f1419";
        ctx.font = "700 48px monospace";
        ctx.fillText(oferta.cupom, cardX + 110, precoBaseY + 312);
      }

      // CTA rodape do card
      ctx.fillStyle = escuro ? "#eceef2" : "#1b1f26";
      ctx.beginPath();
      ctx.roundRect(cardX + 70, cardY + cardH - 165, cardW - 140, 100, 24);
      ctx.fill();
      ctx.fillStyle = escuro ? "#0d0f12" : "#ffffff";
      ctx.font = "700 34px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LINK NO GRUPO OU NA BIO", W / 2, cardY + cardH - 103);
      ctx.textAlign = "left";

      // Rodape fora do card
      ctx.fillStyle = escuro ? "#858c98" : "#6b7280";
      ctx.font = "500 28px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`Oferta verificada · ${arroba}`, W / 2, H - 140);
      ctx.textAlign = "left";
    };

    if (logoInicial) {
      const img = new Image();
      img.onload = () => desenhar(img);
      img.onerror = () => desenhar();
      img.src = logoInicial;
    } else {
      desenhar();
    }
  }, [oferta, escuro, arroba, logoInicial]);

  function baixarPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `story-${oferta.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div
        className="caixa hachura grid w-full max-w-3xl grid-cols-1 gap-6 p-6 md:grid-cols-12"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center md:col-span-6">
          <canvas
            ref={canvasRef}
            className="max-h-[460px] w-auto rounded-[16px] border border-linha shadow-[var(--sombra-alta)]"
          />
        </div>

        <div className="flex flex-col justify-between md:col-span-6">
          <div>
            <div className="flex items-center justify-between">
              <p className="sobrelinha">CARD 9:16 · STORIES & STATUS</p>
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-lg border border-linha text-tinta-3 hover:text-tinta"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold text-tinta">
              Criativo pronto sem abrir o Canva.
            </h2>
            <p className="mt-1 text-sm text-tinta-2">
              Exporta em 1080×1920px com sua logo e seu @ configurados em Marcas e Tags.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-tinta-3">
                  Seu @ no card
                </label>
                <input
                  type="text"
                  value={arroba}
                  onChange={(e) => setArroba(e.target.value)}
                  className="campo font-mono text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-tinta-3">
                  Tema do card
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEscuro(true)}
                    className={`h-10 rounded-[10px] border text-xs font-semibold ${
                      escuro
                        ? "border-acao bg-acao text-acao-texto"
                        : "border-linha bg-superficie text-tinta-2"
                    }`}
                  >
                    Escuro
                  </button>
                  <button
                    type="button"
                    onClick={() => setEscuro(false)}
                    className={`h-10 rounded-[10px] border text-xs font-semibold ${
                      !escuro
                        ? "border-acao bg-acao text-acao-texto"
                        : "border-linha bg-superficie text-tinta-2"
                    }`}
                  >
                    Claro
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={baixarPng}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-acao px-4 text-sm font-semibold text-acao-texto hover:bg-acao-forte"
          >
            <Download className="h-4 w-4" />
            <span>Baixar PNG 9:16 (1080×1920)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
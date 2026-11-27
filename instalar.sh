#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "========================================================="
echo "   PEGA-OFERTA | Ofertas no Piloto Automático"
echo "   Projeto aberto (MIT) · Grátis para sempre"
echo "   Pedágio: seguir @mongarde_ e @joaoedicao no X"
echo "========================================================="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "[ERRO] Node.js não encontrado. Instale o Node.js 22.5+ em https://nodejs.org"
  exit 1
fi

NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "[ERRO] Node.js v$NODE_MAJOR detectado. É necessário Node.js 22.5 ou superior."
  exit 1
fi

echo "[1/3] Instalando dependências do painel..."
npm install

echo ""
echo "[2/3] Instalando motor do WhatsApp (Multi-Instância QR)..."
(cd servicos/whatsapp && npm install)

echo ""
echo "[3/3] Subindo Pega Oferta (Painel + WhatsApp + Coletor 20s)..."
echo "Abra http://localhost:3000/instalar no navegador."
echo ""

(sleep 4 && (open "http://localhost:3000/instalar" 2>/dev/null || xdg-open "http://localhost:3000/instalar" 2>/dev/null || true)) &
npm run tudo
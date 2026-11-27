@echo off
chcp 65001 >nul
title Pega Oferta - Instalador Automatico
color 0E

echo.
echo  =========================================================
echo     PEGA-OFERTA  ^|  Ofertas no Piloto Automatico
echo     Projeto aberto (MIT) - Gratis para sempre
echo     Pedagio: seguir @mongarde_ e @joaoedicao no X
echo  =========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  color 0C
  echo  [ERRO] Node.js nao encontrado neste computador.
  echo  Baixe o Node.js 22+ em: https://nodejs.org
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -v') do set NODE_MAJOR=%%v
set NODE_MAJOR=%NODE_MAJOR:v=%
if %NODE_MAJOR% LSS 22 (
  color 0C
  echo  [ERRO] Node.js v%NODE_MAJOR% detectado. O Pega Oferta precisa do Node.js 22.5 ou superior.
  echo  Atualize em: https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo  [1/3] Instalando dependencias do painel...
call npm install
if %errorlevel% neq 0 (
  color 0C
  echo  [ERRO] Falha ao instalar dependencias do painel.
  pause
  exit /b 1
)

echo.
echo  [2/3] Instalando motor do WhatsApp (Multi-Instancia QR)...
pushd servicos\whatsapp
call npm install
popd

echo.
echo  [3/3] Subindo Pega Oferta (Painel + WhatsApp + Coletor 20s)...
echo  Abrindo http://localhost:3000/instalar no navegador...
echo.
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3000/instalar"
call npm run tudo
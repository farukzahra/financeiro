@echo off
title Financeiro
echo Iniciando Financeiro...

:: API (porta 3001)
start "Financeiro API" /min cmd /c "cd /d %~dp0apps\api && set DATABASE_URL=postgres://postgres:postgres@localhost:5432/financeiro && npx tsx watch src/index.ts"

:: Frontend Vite (porta 5173)
start "Financeiro Web" /min cmd /c "cd /d %~dp0apps\web && npx vite"

:: Aguarda os servidores subirem
echo Aguardando servidores...
timeout /t 5 /nobreak > nul

:: Abre o Electron
echo Abrindo Financeiro...
cd /d %~dp0apps\electron
node_modules\.bin\electron .

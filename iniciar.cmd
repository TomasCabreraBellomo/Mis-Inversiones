@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Primero instala las dependencias con npm ci.
  pause
  exit /b 1
)
echo Abri http://127.0.0.1:5173 en tu navegador.
call npm run dev

@echo off
REM Inicia el sistema completo en Windows (backend + frontend compilado).
cd /d "%~dp0backend"
if not exist pocketbase.exe (
  echo No se encontro backend\pocketbase.exe. Descargalo de https://pocketbase.io/docs/ ^(v0.40.4, windows amd64^).
  pause
  exit /b 1
)
echo Abre en tu navegador:  http://127.0.0.1:8090
echo Panel de PocketBase:    http://127.0.0.1:8090/_/
pocketbase.exe serve --http=0.0.0.0:8090
pause

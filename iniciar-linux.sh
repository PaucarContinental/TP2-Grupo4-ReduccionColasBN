#!/usr/bin/env bash
# Inicia el sistema completo en Linux/Debian (backend + frontend compilado).
set -euo pipefail
cd "$(dirname "$0")/backend"
if [ ! -x ./pocketbase ]; then
  echo "No se encontró backend/pocketbase. Descárgalo de https://pocketbase.io/docs/ (v0.40.4, linux amd64)."
  exit 1
fi
echo "Abre en tu navegador:  http://127.0.0.1:8090"
echo "Panel de PocketBase:    http://127.0.0.1:8090/_/"
exec ./pocketbase serve --http=0.0.0.0:8090

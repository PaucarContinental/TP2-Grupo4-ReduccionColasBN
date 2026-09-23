#!/usr/bin/env bash
# Despliegue en el servidor Debian 12 (ejecutar desde la raíz del repositorio clonado).
set -euo pipefail
DESTINO=/opt/colasbn

sudo apt update && sudo apt install -y unzip curl
sudo mkdir -p "$DESTINO/backend/pb_public"

# 1) Compilar el frontend como sitio estático.
(cd frontend && npm ci && npm run build)

# 2) Copiar backend (migraciones + hooks) y el frontend compilado.
sudo cp -r backend/pb_migrations backend/pb_hooks "$DESTINO/backend/"
sudo rm -rf "$DESTINO/backend/pb_public/"*
sudo cp -r frontend/build/* "$DESTINO/backend/pb_public/"

# 3) Binario de PocketBase (misma versión en todo el equipo).
if [ ! -x "$DESTINO/backend/pocketbase" ]; then
  curl -sL -o /tmp/pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.40.4/pocketbase_0.40.4_linux_amd64.zip
  sudo unzip -o /tmp/pb.zip pocketbase -d "$DESTINO/backend"
fi

# 4) Servicio systemd.
sudo cp docs/despliegue/pocketbase.service /etc/systemd/system/pocketbase.service
sudo chown -R www-data:www-data "$DESTINO"
sudo systemctl daemon-reload
sudo systemctl enable --now pocketbase
sudo systemctl restart pocketbase
sudo systemctl status pocketbase --no-pager
echo "Acceso desde los clientes: http://<IP-servidor>:8090"

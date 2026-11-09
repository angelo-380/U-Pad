#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")

echo "=========================================================="
echo "      INICIANDO SERVICIO COMPLETO U-PAD (WEB + BACKEND)"
echo "=========================================================="
echo "Tu dirección IP en la red Wi-Fi: http://$LAN_IP:3000"
echo "Abriendo servidor unificado en el puerto 3000..."

cd "$DIR/frontend" && npm run build
cd "$DIR/backend"
PORT=3000 node src/server.js

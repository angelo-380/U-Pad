#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ID="project-e287e159-4fc1-4b7f-bf9"
REGION="us-central1"
SERVICE_NAME="upad-backend-service"

echo "[U-Pad] Compilando frontend web..."
cd "$ROOT_DIR/frontend"
npm run build

echo "[U-Pad] Copiando frontend al backend..."
rsync -a --delete "$ROOT_DIR/frontend/dist/" "$ROOT_DIR/backend/public_html/"

echo "[U-Pad] Verificando cuenta y proyecto de Google Cloud..."
gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .
gcloud config set project "$PROJECT_ID" >/dev/null

echo "[U-Pad] Desplegando Cloud Run: $SERVICE_NAME ($REGION)..."
cd "$ROOT_DIR/backend"
gcloud run deploy "$SERVICE_NAME" \
  --source=. \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --project="$PROJECT_ID" \
  --quiet

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --format="value(status.url)")"
echo "[U-Pad] Despliegue terminado: $SERVICE_URL"

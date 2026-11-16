#!/bin/sh
# Arranque del contenedor (Cloud Run).
# Con UPAD_BUCKET: restaura la base desde Cloud Storage (si hay réplica) y arranca el backend bajo
# Litestream, que replica cada cambio al bucket. Sin UPAD_BUCKET: la base vive en el disco del
# contenedor y se pierde al reiniciar o desplegar.
set -eu

DB_PATH="${DB_PATH:-/data/upad_relational.db}"
LITESTREAM_CONFIG="${LITESTREAM_CONFIG:-/etc/litestream.yml}"
export DB_PATH
mkdir -p "$(dirname "$DB_PATH")"

if [ -n "${UPAD_BUCKET:-}" ]; then
  # LITESTREAM_REPLICA_URL solo se cambia para pruebas locales (p. ej. file:///replica)
  LITESTREAM_REPLICA_URL="${LITESTREAM_REPLICA_URL:-gs://${UPAD_BUCKET}/db}"
  export LITESTREAM_REPLICA_URL
  echo "[U-Pad] Restaurando la base desde ${LITESTREAM_REPLICA_URL} (si existe una réplica)..."
  litestream restore -config "$LITESTREAM_CONFIG" -if-db-not-exists -if-replica-exists "$DB_PATH"
  LITESTREAM_ACTIVO=1
  export LITESTREAM_ACTIVO
  exec litestream replicate -config "$LITESTREAM_CONFIG" -exec "node src/server.js"
fi

echo "[U-Pad] AVISO: sin UPAD_BUCKET la base vive en el disco del contenedor y se pierde al reiniciar o desplegar."
exec node src/server.js

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APK_SOURCE="$ROOT_DIR/app/build/outputs/apk/debug/app-debug.apk"
APK_TARGET="$ROOT_DIR/UPad_Cloud_Ready.apk"

cd "$ROOT_DIR"
echo "[U-Pad] Deteniendo daemons Gradle anteriores..."
./gradlew --stop >/dev/null 2>&1 || true

echo "[U-Pad] Compilando APK Debug..."
./gradlew :app:assembleDebug

if [[ ! -f "$APK_SOURCE" ]]; then
  echo "[U-Pad] Error: Gradle terminó pero no produjo $APK_SOURCE" >&2
  exit 1
fi

cp -f "$APK_SOURCE" "$APK_TARGET"
echo "[U-Pad] APK listo: $APK_TARGET"

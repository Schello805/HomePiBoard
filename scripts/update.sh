#!/usr/bin/env bash
set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "=========================================="
echo "  HomePiBoard – System & App Updater      "
echo "=========================================="

echo "==> 1/4: Hole neuesten Code von GitHub..."
git pull

echo "==> 2/4: Prüfe und installiere Node-Pakete..."
npm install

echo "==> 3/4: Baue Frontend..."
npm run build

echo "==> 4/4: Starte Dienst neu..."
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q "homepiboard.service"; then
  sudo systemctl restart homepiboard
  echo "✓ Service 'homepiboard' erfolgreich neu gestartet!"
else
  echo "ℹ Kein aktiver 'homepiboard'-Dienst gefunden. Starte manuell mit: npm start"
fi

echo ""
echo "🎉 Update erfolgreich abgeschlossen!"

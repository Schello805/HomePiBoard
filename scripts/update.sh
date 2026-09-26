#!/usr/bin/env bash
set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "=========================================="
echo "  HomePiBoard – System & App Updater      "
echo "=========================================="

echo "==> 1/5: Sichere Berechtigungen & Git-Konfiguration ab..."
if [ -n "${USER:-}" ] && command -v sudo >/dev/null 2>&1; then
  sudo -n chown -R "${USER}:${USER}" "$APP_DIR" 2>/dev/null || true
fi
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
git config --global --add safe.directory "*" 2>/dev/null || true

echo "==> 2/5: Hole neuesten Code von GitHub..."
git fetch origin main || git fetch --all
git reset --hard origin/main || git pull

echo "==> 3/5: Prüfe und installiere Node-Pakete..."
npm install --no-audit --no-fund

echo "==> 4/5: Baue Frontend (TypeScript & Vite)..."
npm run build

echo "==> 5/5: Starte Backend-Dienst & HDMI-Anzeige neu..."
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q "homepiboard.service"; then
  sudo systemctl restart homepiboard 2>/dev/null || systemctl restart homepiboard 2>/dev/null || true
  echo "✓ Service 'homepiboard' neu gestartet."
fi

if command -v xdotool >/dev/null 2>&1 && DISPLAY=:0 xdotool key F5 2>/dev/null; then
  echo "✓ HDMI-Anzeige via Tastensimulation (F5) neu geladen."
elif pkill -f "chromium|chrome" 2>/dev/null; then
  echo "✓ Kiosk-Browser neu gestartet (Monitor aktualisiert sich automatisch)."
else
  echo "ℹ Kein aktiver Kiosk-Browser gefunden oder Kiosk läuft noch nicht."
fi

echo ""
echo "🎉 Update erfolgreich abgeschlossen! Der Monitor zeigt jetzt die neueste Version."



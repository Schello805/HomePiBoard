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

echo "==> 3/6: Baue Frontend..."
npm run build

echo "==> 4/6: Sichere Dauerbetrieb & HDMI-Audio ab..."
if [ -f "./scripts/disable-sleep.sh" ]; then
  chmod +x ./scripts/disable-sleep.sh
  ./scripts/disable-sleep.sh || true
fi
if [ -f "./scripts/setup-hdmi-audio.sh" ]; then
  chmod +x ./scripts/setup-hdmi-audio.sh
  ./scripts/setup-hdmi-audio.sh || true
fi

echo "==> 5/6: Starte Backend-Dienst neu..."
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q "homepiboard.service"; then
  sudo systemctl restart homepiboard
  echo "✓ Service 'homepiboard' erfolgreich neu gestartet!"
else
  echo "ℹ Kein aktiver 'homepiboard'-Dienst gefunden. Starte manuell mit: npm start"
fi

echo "==> 6/6: Aktualisiere HDMI-Anzeige (Frontend)..."
if command -v xdotool >/dev/null 2>&1 && DISPLAY=:0 xdotool key F5 2>/dev/null; then
  echo "✓ HDMI-Anzeige via Tastensimulation (F5) neu geladen."
elif pkill -f "chromium|chrome" 2>/dev/null; then
  echo "✓ Kiosk-Browser neu gestartet (Monitor aktualisiert sich automatisch in 2 Sekunden)."
else
  echo "ℹ Kein aktiver Kiosk-Browser gefunden oder Kiosk läuft noch nicht."
fi

echo ""
echo "🎉 Update erfolgreich abgeschlossen! Der Monitor zeigt jetzt die neueste Version."


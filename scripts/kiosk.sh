#!/usr/bin/env bash
# HomePiBoard Kiosk Launcher for Raspberry Pi HDMI Display
set -euo pipefail

URL="http://localhost:4173/"
MAX_WAIT=60
WAIT_COUNT=0

echo "[HomePiBoard] Starte Kiosk-Modus für HDMI-Ausgabe..."

# Bildschirmschoner, DPMS und Energiesparmodus deaktivieren (X11 & Konsole)
if command -v xset >/dev/null 2>&1; then
  xset s 0 0 || true
  xset s off || true
  xset -dpms || true
  xset s noblank || true
  xset dpms 0 0 0 || true
fi

if command -v setterm >/dev/null 2>&1; then
  setterm --blank 0 --powersave off --powerdown 0 2>/dev/null || true
fi

# Dauerhafter Wächter: Verhindert Re-Blanking / DPMS-Standby alle 60 Sekunden
(
  while true; do
    if command -v xset >/dev/null 2>&1; then
      xset -dpms 2>/dev/null || true
      xset s off 2>/dev/null || true
      xset s 0 0 2>/dev/null || true
    fi
    sleep 60
  done
) &

# Mauszeiger verstecken falls unclutter vorhanden
if command -v unclutter >/dev/null 2>&1; then
  unclutter -idle 0.5 -root &
fi

# Warten bis der HomePiBoard Server bereit ist
echo "[HomePiBoard] Warte auf Server ($URL)..."
until curl -s -f -o /dev/null "$URL" || [ $WAIT_COUNT -ge $MAX_WAIT ]; do
  sleep 1
  WAIT_COUNT=$((WAIT_COUNT + 1))
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
  echo "[HomePiBoard] Warnung: Server antwortet nicht rechtzeitig, starte Browser dennoch."
fi

# Passenden Chromium-Befehl wählen
CHROMIUM_BIN="chromium-browser"
if ! command -v "$CHROMIUM_BIN" >/dev/null 2>&1; then
  if command -v chromium >/dev/null 2>&1; then
    CHROMIUM_BIN="chromium"
  elif command -v google-chrome >/dev/null 2>&1; then
    CHROMIUM_BIN="google-chrome"
  fi
fi

# Crash-Meldungen bei unsauberem Ausschalten des Pi unterdrücken
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' ~/.config/chromium/Default/Preferences 2>/dev/null || true
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' ~/.config/chromium/Default/Preferences 2>/dev/null || true

# HDMI Audio entmuten und Ausgang konfigurieren
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/setup-hdmi-audio.sh" ]; then
  bash "$SCRIPT_DIR/setup-hdmi-audio.sh" 2>/dev/null || true
fi

# Kiosk-Schleife: Startet Browser automatisch neu, falls er unerwartet schließt
while true; do
  "$CHROMIUM_BIN" \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-translate \
    --no-first-run \
    --fast \
    --fast-start \
    --disable-features=Translate,TranslateUI,PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --check-for-update-interval=31536000 \
    --autoplay-policy=no-user-gesture-required \
    --disable-gesture-requirement-for-media-playback \
    --alsa-output-device=default \
    --allow-running-insecure-content \
    "$URL" || true
  sleep 2
done

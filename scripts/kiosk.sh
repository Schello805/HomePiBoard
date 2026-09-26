#!/usr/bin/env bash
# HomePiBoard Kiosk Launcher for Raspberry Pi HDMI Display
set -euo pipefail

URL="http://localhost:4173/"
MAX_WAIT=60
WAIT_COUNT=0

echo "[HomePiBoard] Starte Kiosk-Modus für HDMI-Ausgabe..."

# Bildschirmschoner und Energiesparmodus deaktivieren (X11)
if command -v xset >/dev/null 2>&1; then
  xset s off || true
  xset -dpms || true
  xset s noblank || true
fi

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

# Kiosk-Schleife: Startet Browser automatisch neu, falls er unerwartet schließt
while true; do
  "$CHROMIUM_BIN" \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --fast \
    --fast-start \
    --disable-features=Translate \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --check-for-update-interval=31536000 \
    --autoplay-policy=no-user-gesture-required \
    "$URL" || true
  sleep 2
done

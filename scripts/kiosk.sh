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

# Pfad zur statischen Splash-/Lade-Seite
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPLASH_FILE="$SCRIPT_DIR/../public/splash.html"
KIOSK_PROFILE_DIR="${HOME}/.config/homepiboard-chromium"
KIOSK_LOG_FILE="${KIOSK_PROFILE_DIR}/chromium.log"
mkdir -p "$KIOSK_PROFILE_DIR"

# HDMI Audio entmuten und Ausgang konfigurieren
if [ -f "$SCRIPT_DIR/setup-hdmi-audio.sh" ]; then
  bash "$SCRIPT_DIR/setup-hdmi-audio.sh" 2>/dev/null || true
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
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$KIOSK_PROFILE_DIR/Default/Preferences" 2>/dev/null || true
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "$KIOSK_PROFILE_DIR/Default/Preferences" 2>/dev/null || true

# Kiosk-Schleife: Startet Browser mit Splash-Screen oder Direkt-URL
while true; do
  LAUNCH_URL="$URL"
  if ! curl -s -f -o /dev/null --max-time 1 "$URL" 2>/dev/null; then
    if [ -f "$SPLASH_FILE" ]; then
      echo "[HomePiBoard] Server startet noch – öffne Ladebildschirm ($SPLASH_FILE)..."
      LAUNCH_URL="file://$SPLASH_FILE"
    fi
  fi

  # Keep Chromium diagnostics available over SSH without growing the log forever.
  if [ -f "$KIOSK_LOG_FILE" ] && [ "$(wc -c < "$KIOSK_LOG_FILE")" -gt 1048576 ]; then
    mv "$KIOSK_LOG_FILE" "${KIOSK_LOG_FILE}.1"
  fi

  echo "[$(date --iso-8601=seconds)] Starte ${CHROMIUM_BIN} mit ${LAUNCH_URL}" >> "$KIOSK_LOG_FILE"
  # Keep this deliberately close to the verified manual launch command.  Several
  # legacy Chromium flags (notably --fast and --fast-start) are no longer useful
  # on current Raspberry Pi OS builds and can make the browser exit at startup.
  set +e
  "$CHROMIUM_BIN" \
    --kiosk \
    --disable-gpu \
    --user-data-dir="$KIOSK_PROFILE_DIR" \
    --enable-logging=stderr \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --touch-events=enabled \
    --autoplay-policy=no-user-gesture-required \
    "$LAUNCH_URL" >> "$KIOSK_LOG_FILE" 2>&1
  CHROMIUM_STATUS=$?
  set -e
  echo "[$(date --iso-8601=seconds)] Chromium wurde beendet (Status ${CHROMIUM_STATUS}). Neustart in 2 Sekunden." >> "$KIOSK_LOG_FILE"
  sleep 2
done

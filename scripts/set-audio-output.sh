#!/usr/bin/env bash
# HomePiBoard: Audio Output Switcher (HDMI vs. 3.5mm Klinke) for Raspberry Pi 3/4/5
set -euo pipefail

TARGET_OUTPUT="${1:-hdmi}"
TARGET_OUTPUT="$(echo "$TARGET_OUTPUT" | tr '[:upper:]' '[:lower:]')"

echo "======================================================"
echo "  HomePiBoard – Audio Output Setup ($TARGET_OUTPUT)"
echo "======================================================"

case "$TARGET_OUTPUT" in
  jack|headphones|headphone|analog|3.5mm)
    MODE="jack"
    RASPI_AUDIO_ID=1
    AMIXER_NUMID=1
    DESCR="3.5mm Klinkenbuchse (Kopfhörer / externe Lautsprecher)"
    ;;
  hdmi|tv|*)
    MODE="hdmi"
    RASPI_AUDIO_ID=2
    AMIXER_NUMID=2
    DESCR="HDMI (Fernseher / Monitor)"
    ;;
esac

echo "[HomePiBoard] Schalte Audioausgang um auf: $DESCR"

# 1. raspi-config Audioausgang setzen (1 = Jack/Headphones, 2 = HDMI)
if command -v raspi-config >/dev/null 2>&1; then
  sudo raspi-config nonint do_audio "$RASPI_AUDIO_ID" 2>/dev/null || true
  echo "✓ raspi-config: Audioausgang auf Modus $RASPI_AUDIO_ID gesetzt."
fi

# 2. Raspberry Pi 3 bcm2835 ALSA Hardware-Routing (numid=3: 0=auto, 1=jack, 2=hdmi)
if command -v amixer >/dev/null 2>&1; then
  for CARD_IDX in 0 1 2; do
    amixer -c "$CARD_IDX" cset numid=3 "$AMIXER_NUMID" 2>/dev/null || true
  done
  amixer cset numid=3 "$AMIXER_NUMID" 2>/dev/null || true
  echo "✓ amixer cset numid=3 auf $AMIXER_NUMID gesetzt (Pi 3 Routing)."
fi

# 3. HDMI Boot-Parameter in config.txt für sauberes HDMI-Audio sicherstellen
CONFIG_TXT=""
if [ -f "/boot/firmware/config.txt" ]; then
  CONFIG_TXT="/boot/firmware/config.txt"
elif [ -f "/boot/config.txt" ]; then
  CONFIG_TXT="/boot/config.txt"
fi

if [ -n "$CONFIG_TXT" ] && [ "$MODE" = "hdmi" ]; then
  if ! grep -q "hdmi_drive=2" "$CONFIG_TXT"; then
    echo "  -> Ergänze hdmi_drive=2 in $CONFIG_TXT..."
    sudo tee -a "$CONFIG_TXT" >/dev/null << 'CONFIG_EOF'

# HomePiBoard: Erzwinge HDMI Audio (kein lautloser DVI-Modus)
hdmi_drive=2
hdmi_drive:0=2
hdmi_drive:1=2
CONFIG_EOF
  fi
fi

# 4. ALSA-Soundkarte ermitteln
CARD_NAME=""
if [ "$MODE" = "hdmi" ]; then
  if aplay -l 2>/dev/null | grep -qi "vc4-hdmi-0\|vc4hdmi0"; then
    CARD_NAME="vc4hdmi0"
  elif aplay -l 2>/dev/null | grep -qi "vc4-hdmi-1\|vc4hdmi1"; then
    CARD_NAME="vc4hdmi1"
  elif aplay -l 2>/dev/null | grep -qi "bcm2835.*hdmi"; then
    CARD_NAME="bcm2835_hdmi"
  elif [ -d "/proc/asound/card1" ]; then
    CARD_NAME="1"
  else
    CARD_NAME="0"
  fi
else
  # 3.5mm Klinke / Headphones
  if aplay -l 2>/dev/null | grep -qi "bcm2835.*headphone"; then
    CARD_NAME="bcm2835_headphones"
  elif aplay -l 2>/dev/null | grep -qi "Headphones"; then
    CARD_NAME="Headphones"
  elif [ -d "/proc/asound/card0" ]; then
    CARD_NAME="0"
  else
    CARD_NAME="default"
  fi
fi

echo "  -> Ausgewählte ALSA-Karte: $CARD_NAME"

# 5. ALSA-Mixer entmuten und Lautstärke auf 100% setzen
for C in "$CARD_NAME" 0 1 2 vc4hdmi0 vc4hdmi1 bcm2835_hdmi bcm2835_headphones Headphones; do
  amixer -c "$C" sset 'IEC958' on 2>/dev/null || true
  amixer -c "$C" sset 'IEC958' unmute 2>/dev/null || true
  amixer -c "$C" sset 'Master' unmute 2>/dev/null || true
  amixer -c "$C" sset 'Master' 100% 2>/dev/null || true
  amixer -c "$C" sset 'PCM' unmute 2>/dev/null || true
  amixer -c "$C" sset 'PCM' 100% 2>/dev/null || true
  amixer -c "$C" sset 'HDMI' unmute 2>/dev/null || true
  amixer -c "$C" sset 'HDMI' 100% 2>/dev/null || true
  amixer -c "$C" sset 'Headphone' unmute 2>/dev/null || true
  amixer -c "$C" sset 'Headphone' 100% 2>/dev/null || true
done
amixer sset Master unmute 100% 2>/dev/null || true
amixer sset PCM unmute 100% 2>/dev/null || true
amixer sset Headphone unmute 100% 2>/dev/null || true

# 6. ~/.asoundrc und /etc/asound.conf schreiben
if [ -n "$CARD_NAME" ] && [ "$CARD_NAME" != "default" ]; then
  cat << ASOUND_EOF > "${HOME}/.asoundrc"
# HomePiBoard: Audioausgang ($MODE)
pcm.!default {
  type plug
  slave.pcm {
    type hw
    card $CARD_NAME
    device 0
  }
}

ctl.!default {
  type hw
  card $CARD_NAME
}
ASOUND_EOF

  sudo cp "${HOME}/.asoundrc" /etc/asound.conf 2>/dev/null || true
fi

# 7. PulseAudio / PipeWire Standard-Sink setzen falls aktiv
if command -v pactl >/dev/null 2>&1; then
  if [ "$MODE" = "hdmi" ]; then
    SINK=$(pactl list short sinks 2>/dev/null | grep -i "hdmi" | awk '{print $2}' | head -n 1 || true)
  else
    SINK=$(pactl list short sinks 2>/dev/null | grep -iv "hdmi" | awk '{print $2}' | head -n 1 || true)
  fi
  if [ -n "$SINK" ]; then
    pactl set-default-sink "$SINK" 2>/dev/null || true
    pactl set-sink-volume "$SINK" 100% 2>/dev/null || true
    pactl set-sink-mute "$SINK" 0 2>/dev/null || true
    echo "✓ PulseAudio/PipeWire Standard-Sink auf '$SINK' gesetzt."
  fi
fi

if command -v wpctl >/dev/null 2>&1; then
  if [ "$MODE" = "hdmi" ]; then
    WP_ID=$(wpctl status 2>/dev/null | grep -i "hdmi" | grep -o '[0-9]\+' | head -n 1 || true)
  else
    WP_ID=$(wpctl status 2>/dev/null | grep -i "headphone\|analog\|built-in" | grep -o '[0-9]\+' | head -n 1 || true)
  fi
  if [ -n "$WP_ID" ]; then
    wpctl set-default "$WP_ID" 2>/dev/null || true
    wpctl set-volume "$WP_ID" 1.0 2>/dev/null || true
    echo "✓ WirePlumber Standard-Ausgang auf ID $WP_ID gesetzt."
  fi
fi

echo "🎉 Audioausgang erfolgreich auf '$MODE' ($DESCR) umgestellt!"

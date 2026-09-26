#!/usr/bin/env bash
# HomePiBoard: HDMI Audio Output Configuration & Unmute
set -euo pipefail

echo "======================================================"
echo "  HomePiBoard – HDMI Audio Setup                     "
echo "======================================================"

# 1. Raspberry Pi OS raspi-config Audio auf HDMI (2 = HDMI) erzwingen
if command -v raspi-config >/dev/null 2>&1; then
  sudo raspi-config nonint do_audio 2 2>/dev/null || true
  echo "✓ raspi-config: Audioausgang auf HDMI (2) gesetzt."
fi

# 2. Kernel/GPU Boot-Parameter: hdmi_drive=2 (HDMI Audio erzwingen statt DVI)
CONFIG_TXT=""
if [ -f "/boot/firmware/config.txt" ]; then
  CONFIG_TXT="/boot/firmware/config.txt"
elif [ -f "/boot/config.txt" ]; then
  CONFIG_TXT="/boot/config.txt"
fi

if [ -n "$CONFIG_TXT" ]; then
  echo "==> Prüfe $CONFIG_TXT auf hdmi_drive=2..."
  if ! grep -q "hdmi_drive=2" "$CONFIG_TXT"; then
    echo "  -> Füge 'hdmi_drive=2' hinzu (erzwingt HDMI Audio zum TV)..."
    sudo tee -a "$CONFIG_TXT" >/dev/null << 'CONFIG_EOF'

# HomePiBoard: Erzwinge HDMI Audio (kein lautloser DVI-Modus)
hdmi_drive=2
hdmi_drive:0=2
hdmi_drive:1=2
CONFIG_EOF
    echo "✓ hdmi_drive=2 erfolgreich in $CONFIG_TXT eingetragen."
  else
    echo "✓ hdmi_drive=2 ist bereits aktiv."
  fi
fi

# 3. HDMI Soundkarte in ALSA identifizieren
echo "==> Ermittle HDMI-Soundkarte..."
HDMI_CARD=""
if aplay -l 2>/dev/null | grep -qi "vc4-hdmi-0\|vc4hdmi0"; then
  HDMI_CARD="vc4hdmi0"
elif aplay -l 2>/dev/null | grep -qi "vc4-hdmi-1\|vc4hdmi1"; then
  HDMI_CARD="vc4hdmi1"
elif aplay -l 2>/dev/null | grep -qi "bcm2835.*hdmi"; then
  HDMI_CARD="bcm2835_hdmi"
fi

# Falls keine namentliche Karte erkannt wird, prüfe Card 1 oder Card 0
if [ -z "$HDMI_CARD" ]; then
  if [ -d "/proc/asound/card1" ]; then
    HDMI_CARD="1"
  else
    HDMI_CARD="0"
  fi
fi

echo "  -> Gefundene HDMI-Audiokarte: $HDMI_CARD"

# 4. ALSA Mixer für alle Kanäle entmuten und auf 100% Lautstärke stellen
echo "==> Entmute HDMI-Audiokanäle..."
for CARD in "$HDMI_CARD" 0 1 2 vc4hdmi0 vc4hdmi1; do
  amixer -c "$CARD" sset 'IEC958' on 2>/dev/null || true
  amixer -c "$CARD" sset 'IEC958' unmute 2>/dev/null || true
  amixer -c "$CARD" sset 'Master' unmute 2>/dev/null || true
  amixer -c "$CARD" sset 'Master' 100% 2>/dev/null || true
  amixer -c "$CARD" sset 'PCM' unmute 2>/dev/null || true
  amixer -c "$CARD" sset 'PCM' 100% 2>/dev/null || true
  amixer -c "$CARD" sset 'HDMI' unmute 2>/dev/null || true
  amixer -c "$CARD" sset 'HDMI' 100% 2>/dev/null || true
done
amixer sset Master unmute 100% 2>/dev/null || true
amixer sset PCM unmute 100% 2>/dev/null || true
echo "✓ ALSA Lautstärkeregler entmutet und auf 100% gesetzt."

# 5. ~/.asoundrc und /etc/asound.conf konfigurieren, damit HDMI Standard-Ausgang ist
echo "==> Richte HDMI als ALSA-Standard-Audiogerät ein..."
cat << ASOUND_EOF > "${HOME}/.asoundrc"
# HomePiBoard: HDMI Audio als Standard-ALSA-Ausgang
pcm.!default {
  type plug
  slave.pcm {
    type hw
    card $HDMI_CARD
    device 0
  }
}

ctl.!default {
  type hw
  card $HDMI_CARD
}
ASOUND_EOF

# Optional auch systemweit in /etc/asound.conf kopieren
sudo cp "${HOME}/.asoundrc" /etc/asound.conf 2>/dev/null || true
echo "✓ ~/.asoundrc und /etc/asound.conf auf Karte '$HDMI_CARD' konfiguriert."

# 6. PipeWire / PulseAudio falls aktiv auf HDMI umstellen
if command -v pactl >/dev/null 2>&1; then
  HDMI_SINK=$(pactl list short sinks 2>/dev/null | grep -i "hdmi" | awk '{print $2}' | head -n 1 || true)
  if [ -n "$HDMI_SINK" ]; then
    pactl set-default-sink "$HDMI_SINK" 2>/dev/null || true
    pactl set-sink-volume "$HDMI_SINK" 100% 2>/dev/null || true
    pactl set-sink-mute "$HDMI_SINK" 0 2>/dev/null || true
    echo "✓ PulseAudio/PipeWire Standard-Sink auf '$HDMI_SINK' gesetzt."
  fi
fi

if command -v wpctl >/dev/null 2>&1; then
  WP_HDMI=$(wpctl status 2>/dev/null | grep -i "hdmi" | grep -o '[0-9]\+' | head -n 1 || true)
  if [ -n "$WP_HDMI" ]; then
    wpctl set-default "$WP_HDMI" 2>/dev/null || true
    wpctl set-volume "$WP_HDMI" 1.0 2>/dev/null || true
    echo "✓ WirePlumber (PipeWire) Standard-Ausgang auf HDMI ID $WP_HDMI gesetzt."
  fi
fi

echo ""
echo "🎉 HDMI-Audio erfolgreich eingerichtet!"
echo "Tipp zum Testen: speaker-test -c 2 -t wav -l 1"

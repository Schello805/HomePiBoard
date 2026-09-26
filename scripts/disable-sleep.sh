#!/usr/bin/env bash
# HomePiBoard: Standby, Bildschirmschoner und Energiesparmodus systemweit deaktivieren
set -euo pipefail

echo "======================================================"
echo "  HomePiBoard – Display & System Always-On Setup      "
echo "======================================================"

# 1. Raspberry Pi OS raspi-config Screen Blanking deaktivieren
echo "==> 1/6: Deaktiviere Raspberry Pi OS Screen Blanking..."
if command -v raspi-config >/dev/null 2>&1; then
  sudo raspi-config nonint do_blanking 1 2>/dev/null || true
  echo "✓ raspi-config Blanking deaktiviert."
fi

# 2. Kernel Console Blanking (consoleblank=0)
echo "==> 2/6: Prüfe Linux-Kernel Boot-Parameter (consoleblank=0)..."
CMDLINE_PATH=""
if [ -f "/boot/firmware/cmdline.txt" ]; then
  CMDLINE_PATH="/boot/firmware/cmdline.txt"
elif [ -f "/boot/cmdline.txt" ]; then
  CMDLINE_PATH="/boot/cmdline.txt"
fi

if [ -n "$CMDLINE_PATH" ]; then
  if ! grep -q "consoleblank=0" "$CMDLINE_PATH"; then
    echo "  -> Füge 'consoleblank=0' zu $CMDLINE_PATH hinzu..."
    sudo sed -i 's/$/ consoleblank=0/' "$CMDLINE_PATH"
    echo "✓ Kernel-Console-Blanking dauerhaft deaktiviert."
  else
    echo "✓ 'consoleblank=0' ist bereits in $CMDLINE_PATH eingetragen."
  fi
fi

# 3. Systemd Sleep-, Suspend- und Hibernate-Ziele maskieren
echo "==> 3/6: Maskiere systemd Sleep- & Suspend-Ziele..."
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target 2>/dev/null || true
  echo "✓ systemd Sleep-Ziele erfolgreich maskiert (Pi schläft niemals ein)."
fi

# 4. LightDM X11 Konfiguration (falls Desktop-Image verwendet wird)
echo "==> 4/6: Konfiguriere X11 / LightDM Energiesparmodus..."
LIGHTDM_CONF="/etc/lightdm/lightdm.conf"
if [ -f "$LIGHTDM_CONF" ]; then
  if grep -q "^xserver-command=" "$LIGHTDM_CONF"; then
    sudo sed -i 's/^xserver-command=.*/xserver-command=X -s 0 -dpms/' "$LIGHTDM_CONF"
  else
    sudo sed -i '/\[Seat:\*\]/a xserver-command=X -s 0 -dpms' "$LIGHTDM_CONF" 2>/dev/null || true
  fi
  echo "✓ LightDM xserver-command mit '-s 0 -dpms' aktualisiert."
fi

# 5. Wayland / Wayfire Konfiguration (Raspberry Pi OS Bookworm)
echo "==> 5/6: Prüfe Wayland / Wayfire Konfiguration..."
WAYFIRE_INI="${HOME}/.config/wayfire.ini"
if [ -f "$WAYFIRE_INI" ] || command -v wayfire >/dev/null 2>&1; then
  mkdir -p "${HOME}/.config"
  if ! grep -q "\[idle\]" "$WAYFIRE_INI" 2>/dev/null; then
    cat << 'WEOF' >> "$WAYFIRE_INI"

[idle]
toggle = none
screensaver_timeout = 0
dpms_timeout = 0
WEOF
    echo "✓ Wayfire Idle/DPMS-Timeout auf 0 gesetzt."
  fi
fi

# 6. Sofortige X11-Laufzeiteinstellungen anwenden
echo "==> 6/6: Wende sofortige X11- und Framebuffer-Einstellungen an..."
if [ -n "${DISPLAY:-}" ] || [ -f "/tmp/.X11-unix/X0" ]; then
  DISPLAY="${DISPLAY:-:0}"
  export DISPLAY
  if command -v xset >/dev/null 2>&1; then
    xset s 0 0 2>/dev/null || true
    xset s off 2>/dev/null || true
    xset -dpms 2>/dev/null || true
    xset s noblank 2>/dev/null || true
    xset dpms 0 0 0 2>/dev/null || true
    echo "✓ Aktive X11-Anzeige ($DISPLAY) auf No-Sleep gesetzt."
  fi
fi

if command -v setterm >/dev/null 2>&1; then
  setterm --blank 0 --powersave off --powerdown 0 2>/dev/null || true
fi

echo ""
echo "🎉 Fertig! Bildschirm und Raspberry Pi bleiben ab sofort dauerhaft eingeschaltet."

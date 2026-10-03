#!/usr/bin/env bash
# HomePiBoard: Fehlende Systempakete für den Kiosk-Modus nachinstallieren.
# Wird von scripts/update.sh und vom Web-Updater (server.mjs) aufgerufen,
# damit bestehende Installationen neue Abhängigkeiten (z. B. Touch-Treiber)
# auch ohne erneutes Ausführen von install.sh erhalten.
#
# Bricht nie mit Fehler ab – ein Update soll daran nicht scheitern.
# Paketliste synchron mit scripts/install.sh halten.
set -uo pipefail

REQUIRED_PACKAGES=(
  unclutter
  xserver-xorg
  xserver-xorg-input-libinput
  xinit
  x11-xserver-utils
  xserver-xorg-legacy
  openbox
  libgl1-mesa-dri
  alsa-utils
)

if ! command -v dpkg-query >/dev/null 2>&1 || ! command -v apt-get >/dev/null 2>&1; then
  echo "ℹ Kein Debian/Raspberry-Pi-System erkannt – Systempaket-Prüfung übersprungen."
  exit 0
fi

MISSING=()
for pkg in "${REQUIRED_PACKAGES[@]}"; do
  if ! dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q "install ok installed"; then
    MISSING+=("$pkg")
  fi
done

if [ "${#MISSING[@]}" -eq 0 ]; then
  echo "✓ Alle Systempakete vorhanden."
  exit 0
fi

echo "→ Fehlende Systempakete: ${MISSING[*]}"

if ! sudo -n true 2>/dev/null; then
  echo "⚠ Keine passwortlosen sudo-Rechte – bitte manuell installieren:"
  echo "    sudo apt-get install -y --no-install-recommends ${MISSING[*]} && sudo reboot"
  exit 0
fi

apt_install() {
  sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    -o DPkg::Lock::Timeout=120 "${MISSING[@]}"
}

if apt_install || { sudo -n env DEBIAN_FRONTEND=noninteractive apt-get update -o DPkg::Lock::Timeout=120 && apt_install; }; then
  echo "✓ Systempakete installiert: ${MISSING[*]}"
  echo "ℹ Bitte den Pi einmal neu starten (sudo reboot), damit X11 neue Eingabetreiber (z. B. Touch) lädt."
else
  echo "⚠ Installation fehlgeschlagen – bitte manuell ausführen:"
  echo "    sudo apt-get update && sudo apt-get install -y --no-install-recommends ${MISSING[*]} && sudo reboot"
fi

exit 0

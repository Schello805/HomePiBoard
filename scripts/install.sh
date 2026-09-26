#!/usr/bin/env bash
# HomePiBoard One-Line Installer für Raspberry Pi OS Lite & Desktop
set -euo pipefail

DEFAULT_PIN="0000"
REPO_URL="https://github.com/Schello805/HomePiBoard.git"
INSTALL_DIR="${HOME}/HomePiBoard"

echo "==========================================================="
echo "  🚀 Starte HomePiBoard Installation auf dem Raspberry Pi"
echo "==========================================================="

# 1. Systempakete aktualisieren und Voraussetzungen installieren
echo "[1/6] Aktualisiere Paketlisten und installiere Systempakete..."
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl git unclutter

# Für OS Lite: Leichtgewichtige X11-Umgebung und Chromium installieren
echo "  -> Installiere X11, Openbox und Chromium für Kiosk-Ausgabe auf OS Lite..."
sudo apt-get install -y --no-install-recommends \
  xserver-xorg \
  xinit \
  x11-xserver-utils \
  xserver-xorg-legacy \
  openbox \
  libgl1-mesa-dri \
  alsa-utils

# Chromium Browser installieren (auf Debian 12 / arm64 heißt das Paket 'chromium')
if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1; then
  echo "  -> Installiere Chromium Browser..."
  sudo apt-get install -y chromium 2>/dev/null || sudo apt-get install -y chromium-browser 2>/dev/null || true
fi

# X11 non-root Berechtigung für tty1 / OS Lite sicherstellen
sudo tee /etc/X11/Xwrapper.config > /dev/null << 'WRAPPER_EOF'
allowed_users=anybody
needs_root_rights=yes
WRAPPER_EOF

# Audio-Berechtigungen und HDMI-Soundausgabe konfigurieren
echo "  -> Konfiguriere Audio-Berechtigungen und HDMI-Sound..."
sudo usermod -aG audio,video,render "${USER}" 2>/dev/null || true
amixer sset Master unmute 2>/dev/null || amixer sset PCM unmute 2>/dev/null || true
amixer sset Master 100% 2>/dev/null || amixer sset PCM 100% 2>/dev/null || true
if command -v raspi-config >/dev/null 2>&1; then
  sudo raspi-config nonint do_audio 2 2>/dev/null || true
fi

# 2. Node.js 22 LTS prüfen / installieren
echo "[2/6] Prüfe Node.js Installation..."
INSTALL_NODE=false
if ! command -v node >/dev/null 2>&1; then
  INSTALL_NODE=true
else
  NODE_MAJOR=$(node -v | cut -d'.' -f1 | tr -d 'v')
  if [ "$NODE_MAJOR" -lt 22 ]; then
    INSTALL_NODE=true
  fi
fi

if [ "$INSTALL_NODE" = true ]; then
  echo "  -> Installiere Node.js 22 LTS via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "  -> Node.js Version: $(node -v)"

# 3. HomePiBoard Repository klonen oder aktualisieren
echo "[3/6] Richte HomePiBoard Repository ein..."
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "  -> Vorhandenes Repository in $INSTALL_DIR wird aktualisiert..."
  cd "$INSTALL_DIR"
  git pull --rebase
else
  echo "  -> Klone $REPO_URL nach $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# 4. Abhängigkeiten installieren & Produktionsbuild erstellen
echo "[4/6] Installiere Node-Abhängigkeiten und erstelle Build..."
npm install
npm run build

# 5. systemd Service für HomePiBoard Server einrichten
echo "[5/6] Richte systemd-Dienst (homepiboard.service) ein..."
sudo tee /etc/systemd/system/homepiboard.service > /dev/null << SERVICE_EOF
[Unit]
Description=HomePiBoard Digital Signage Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
Environment=PORT=4173
Environment=HOMEPIBOARD_PIN=${DEFAULT_PIN}
ExecStart=$(which node) ${INSTALL_DIR}/server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SERVICE_EOF

sudo systemctl daemon-reload
sudo systemctl enable homepiboard.service
sudo systemctl restart homepiboard.service

# 6. Kiosk-Autostart auf HDMI konfigurieren
echo "[6/6] Konfiguriere Kiosk-Autostart & Always-On für HDMI..."
chmod +x "${INSTALL_DIR}/scripts/kiosk.sh"
chmod +x "${INSTALL_DIR}/scripts/disable-sleep.sh"
"${INSTALL_DIR}/scripts/disable-sleep.sh" || true

# xinitrc für OS Lite Kiosk vorbereiten
cat << XINIT_EOF > "${HOME}/.xinitrc"
#!/usr/bin/env sh
# Bildschirmschoner und Stromsparmodus deaktivieren
xset s 0 0 || true
xset s off || true
xset -dpms || true
xset s noblank || true
xset dpms 0 0 0 || true

# Openbox im Hintergrund
openbox &

# Kiosk-Browser starten
exec ${INSTALL_DIR}/scripts/kiosk.sh
XINIT_EOF
chmod +x "${HOME}/.xinitrc"

# Falls Autologin auf der Konsole aktiv ist, xinit bei Login auf tty1 starten
for PROFILE_FILE in "${HOME}/.bash_profile" "${HOME}/.profile"; do
  if ! grep -q "startx" "$PROFILE_FILE" 2>/dev/null; then
    cat << 'PROFILE_EOF' >> "$PROFILE_FILE"

# HomePiBoard: Starte X11 Kiosk automatisch auf tty1 (HDMI)
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  startx -- -nocursor
fi
PROFILE_EOF
  fi
done

# Desktop-Autologin bzw. Console-Autologin aktivieren
if command -v raspi-config >/dev/null 2>&1; then
  sudo raspi-config nonint do_boot_behaviour B2 || true
fi

# IP-Adresse ermitteln
IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$IP_ADDR" ]; then
  IP_ADDR=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}')
fi
if [ -z "$IP_ADDR" ]; then
  IP_ADDR="<DEINE-PI-IP>"
fi

echo ""
echo "==========================================================="
echo "  🎉 HomePiBoard wurde erfolgreich installiert!"
echo "==========================================================="
echo ""
echo "  📺 HDMI-Anzeige:       http://localhost:4173/ (startet auf HDMI)"
echo "  🌐 Web-Anzeige:        http://${IP_ADDR}:4173/"
echo "  ⚙️ Admin-Bereich:      http://${IP_ADDR}:4173/admin"
echo ""
echo "  🔑 Standard-PIN:       ${DEFAULT_PIN}"
echo ""
echo "==========================================================="
echo "  ⚠️ WICHTIG – JETZT NEUSTARTEN:"
echo "  Damit der Kiosk-Modus auf deinem HDMI-Monitor startet,"
echo "  führe bitte folgenden Befehl aus:"
echo ""
echo "    sudo reboot"
echo "==========================================================="
echo ""

# Raspberry Pi HDMI-Setup & Kiosk-Modus

Diese Anleitung beschreibt, wie HomePiBoard auf einem **Raspberry Pi (3, 4, 5 oder Zero 2W)** installiert und über den **HDMI-Ausgang** als vollwertiges Digital-Signage-Display betrieben wird.

---

## 1. Übersicht & Architektur

- **HDMI-Ausgabe (Anzeige):** Der Pi bootet automatisch in den Desktop, startet den lokalen HomePiBoard-Server und öffnet Chromium im randlosen Vollbild-Kioskmodus auf `http://localhost:4173/`.
- **Admin-Steuerung (Editing):** Die Konfiguration und das Hinzufügen von Widgets erfolgt bequem über das Netzwerk von einem PC, Mac oder Smartphone über die lokale IP: `http://<pi-ip>:4173/admin`.
- **Mauszeiger:** Wird im Kiosk-Modus automatisch nach 2 Sekunden Inaktivität ausgeblendet.

---

## 2. Raspberry Pi OS Grundeinstellungen

1. Im Raspberry Pi Terminal `sudo raspi-config` öffnen:
   - **System Options -> Boot / Auto Login:** `Desktop Autologin` (Benutzer meldet sich automatisch am Desktop an).
   - **Display Options -> Resolution:** Auf die native Auflösung deines TVs/Monitors einstellen (z. B. `1920x1080 60Hz`).
   - **Localisation Options:** Zeitzone (z. B. `Europe/Berlin`) und Tastaturlayout einstellen.
2. Neustart: `sudo reboot`.

---

## 3. Installation von Node.js & HomePiBoard

```bash
# Node.js 22 LTS installieren (falls noch nicht vorhanden)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git unclutter

# HomePiBoard klonen
cd /home/pi
git clone https://github.com/Schello805/HomePiBoard.git
cd HomePiBoard

# Abhängigkeiten installieren & Produktionsbuild erstellen
npm install
npm run build
```

---

## 4. Server-Autostart einrichten (systemd)

Damit der Server beim Einschalten des Pi sofort startet:

```bash
# Service-Datei kopieren
sudo cp scripts/homepiboard.service /etc/systemd/system/

# Service aktivieren und starten
sudo systemctl daemon-reload
sudo systemctl enable homepiboard
sudo systemctl start homepiboard

# Status prüfen
sudo systemctl status homepiboard
```

---

## 5. HDMI-Kiosk-Autostart einrichten

### Für Raspberry Pi OS mit Wayland / labwc (Standard bei Pi OS Bookworm):

Erstelle oder bearbeite die Autostart-Datei:

```bash
mkdir -p ~/.config/labwc
nano ~/.config/labwc/autostart
```

Füge folgende Zeile am Ende ein:
```bash
/home/pi/HomePiBoard/scripts/kiosk.sh &
```

*(Für ältere X11-Systeme / Bullseye: In `~/.config/lxsession/LXDE-pi/autostart` die Zeile `@/home/pi/HomePiBoard/scripts/kiosk.sh` einfügen).*

---

## 6. Bildschirm-Abschaltung bei Nacht (CEC / Display Power)

Um den HDMI-Bildschirm nachts automatisch auszuschalten und morgens einzuschalten, kannst du `cron` nutzen:

`crontab -e` öffnen und eintragen:

```bash
# Bildschirm Mo-So um 23:00 Uhr ausschalten
0 23 * * * vcgencmd display_power 0

# Bildschirm Mo-So um 06:30 Uhr einschalten
30 6 * * * vcgencmd display_power 1
```

*(Bei Fernsehern mit CEC kann alternativ `cec-client` verwendet werden: `echo 'standby 0' | cec-client -s -d 1` bzw. `echo 'on 0' | cec-client -s -d 1`).*

---

## 7. Sinnvolle Einstellungen im Admin-Panel (`⚙ System & HDMI`)

- **Display-Zoom / Skalierung:** Für typische TV-Entfernungen (2-3 Meter) empfiehlt sich **125%** oder **150%**.
- **Erkannte HDMI-Auflösung:** Zeigt die tatsächliche Auflösung des Displays an.
- **Mauszeiger ausblenden:** Aktiviert das automatische Verstecken des Zeigers.
- **Zeitzone & Sprache:** Automatisch oder `Europe/Berlin` / `de-DE`.
- **Sekunden:** Bei Bedarf Sekundenanzeige auf der Digitaluhr aktivieren.
- **Live-Telemetrie:** Überwacht CPU-Temperatur, RAM und Uptime des Pi direkt im Admin-Panel.

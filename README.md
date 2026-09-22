# HomePiBoard

![HomePiBoard Logo](/homepiboard-logo.svg)

Eine schlanke Digital-Signage-Anzeige für zu Hause. Die Anwendung ist für einen Raspberry Pi 3B mit Chromium im Kiosk-Modus gedacht.

## Lokal starten

```bash
npm install
npm run dev
```

Die Anzeige ist danach unter `http://localhost:5173/` erreichbar.

## Produktionsbuild

```bash
npm run build
npm run preview
```

## Installation auf Raspberry Pi 3B

Für ein einzelnes Gerät ist Raspberry Pi OS mit Desktop (32-bit) am einfachsten. Im Raspberry Pi Imager können WLAN, Benutzername und SSH bereits vorkonfiguriert werden.

Auf dem Pi:

```bash
sudo apt update
sudo apt install -y git nodejs npm nginx chromium-browser
git clone https://github.com/Schello805/HomePiBoard.git
cd HomePiBoard
npm install
npm run build
sudo rm -rf /var/www/homepiboard
sudo mkdir -p /var/www/homepiboard
sudo cp -r dist/* /var/www/homepiboard/
```

Danach kann nginx den Build ausliefern. Für die Wandanzeige wird Chromium im Kiosk-Modus auf `http://localhost/` gestartet. Der automatische Chromium-Start und der Neustart bei Stromausfall sind noch gerätespezifisch einzurichten.

Für den Raspberry Pi kann der erzeugte `dist/`-Ordner mit einem kleinen statischen Webserver ausgeliefert werden. Chromium startet anschließend die Anzeige im Vollbild:

```bash
chromium-browser --kiosk http://localhost:4173
```

Die Einstellungen werden in der aktuellen Browser-Installation gespeichert. Unter `/admin` können Ort, Wetterort und Widgets angepasst werden. Es gibt die Typen Webseite, Kalender, Text und Bild. Widget-Breite und -Höhe lassen sich direkt an der unteren rechten Ecke jeder Karte im feinen 24×8-Raster ziehen. Bestehende Layouts werden automatisch migriert. Das optionale Wettermodul nutzt Open-Meteo und benötigt Internetzugang.

Die offenen Aufgaben stehen in [TODO.md](TODO.md).

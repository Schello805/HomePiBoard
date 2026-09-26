# HomePiBoard

Eine schlanke Digital-Signage-Anzeige für zu Hause. HomePiBoard ist für einen Raspberry Pi mit Chromium im Kiosk-Modus gedacht und benötigt im Betrieb keine Datenbank.

## Funktionen

- 24×14-Widget-Raster für Webseite, Kalender, Text, Bild und Diashow
- Freies Resizing und 4-Wege-Positionierung im Platzspar-Editmodus
- HDMI-Kiosk-Modus mit automatischer Mauszeiger-Ausblendung
- Display-Zoom (80%–150%) für Fernseher und Wand-Displays
- Raspberry Pi Live-Telemetrie (CPU-Temperatur, RAM, CPU-Load, lokale IP, Uptime)
- Einstellbare Zeitzone, Sprache/Datumsformat und Sekundenanzeige
- Wetterdaten über Open-Meteo
- Direkter Bilder-Upload (PNG, JPG, WebP, GIF, SVG bis 5 MB)
- zentrale Konfiguration in `data/settings.json`
- lokaler Browser-Cache als Offline-Rückfall
- PIN-Schutz für Änderungen
- statischer Client und kleiner Node.js-Server ohne Runtime-Abhängigkeiten

## Voraussetzungen

- Node.js 22.18 oder neuer
- npm

## Entwicklung

```bash
npm install
npm run dev
```

Vite startet den Client üblicherweise unter `http://localhost:5173`. Ohne laufenden HomePiBoard-Server arbeitet der Client im lokalen Offline-Modus und speichert nur in diesem Browser.

## Tests und Build

```bash
npm run check
```

Der Befehl führt alle Tests und anschließend den Produktionsbuild aus.

## Lokal im Produktionsmodus starten

```bash
npm run build
HOMEPIBOARD_PIN=2468 npm start
```

Danach sind erreichbar:

- Anzeige: `http://localhost:4173/`
- Konfiguration: `http://localhost:4173/admin`

`HOMEPIBOARD_PIN` muss gesetzt sein; ohne explizite PIN startet der Server nicht. Neu vergebene PINs müssen aus 4 bis 64 Ziffern bestehen. Eine längere PIN bietet zusätzlichen Schutz.

Nach dem ersten Start kann die PIN im Adminbereich unter **Sicherheit → Admin-PIN → PIN ändern** geändert werden. Die neue PIN wird ausschließlich als gesalzener Scrypt-Hash in `data/auth.json` gespeichert und bleibt nach Neustarts aktiv. Falls die PIN vergessen wurde, stoppe den Server, lösche `data/auth.json` und starte ihn mit einer neuen `HOMEPIBOARD_PIN` erneut.

Die zentrale Konfiguration wird beim ersten Speichern in `data/settings.json` angelegt. Wenn der Server vorübergehend nicht erreichbar ist, verwendet die Anzeige die zuletzt im Browser gespeicherte Konfiguration.

## Installation auf einem Raspberry Pi

Repository klonen und Build erstellen:

```bash
git clone https://github.com/Schello805/HomePiBoard.git
cd HomePiBoard
npm install
npm run check
```

### Systemd-Service

`/etc/systemd/system/homepiboard.service` anlegen:

```ini
[Unit]
Description=HomePiBoard signage server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/HomePiBoard
Environment=NODE_ENV=production
Environment=PORT=4173
Environment=HOMEPIBOARD_PIN=EINE_EIGENE_PIN_MIT_MINDESTENS_4_ZIFFERN
ExecStart=/usr/bin/node /home/pi/HomePiBoard/server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Anschließend aktivieren:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now homepiboard
sudo systemctl status homepiboard
```

Pfade und Benutzername müssen gegebenenfalls an die lokale Installation angepasst werden.

### Chromium im Kiosk-Modus

Chromium kann nach dem Start der grafischen Sitzung mit folgendem Ziel geöffnet werden:

```bash
chromium --kiosk --noerrdialogs --disable-infobars http://localhost:4173/
```

Je nach Raspberry-Pi-OS-Version kann der Programmname auch `chromium-browser` lauten. Der Befehl kann über die Autostart-Konfiguration der verwendeten Desktop-Sitzung gestartet werden.

Ausführliche Hinweise zur Einrichtung, HDMI-Kiosk-Autostart und CEC-Bildschirmabschaltung findest du in [docs/raspberry-pi-hdmi.md](docs/raspberry-pi-hdmi.md). Ein fertiges Kiosk-Skript liegt unter [scripts/kiosk.sh](scripts/kiosk.sh).

## API

- `GET /api/settings` – aktuelle Konfiguration lesen
- `GET /api/system` – Hardware-, Netzwerk- und System-Telemetrie lesen (CPU-Temp, RAM, IP, Uptime)
- `POST /api/auth` – Admin-PIN prüfen
- `PUT /api/settings` – Konfiguration mit Header `x-admin-pin` speichern
- `PUT /api/admin-pin` – Admin-PIN mit aktueller PIN im Header `x-admin-pin` ändern
- `POST /api/upload` – Bilddatei hochladen (PNG, JPG, WebP, GIF, SVG bis 5 MB, erfordert `x-admin-pin`)
- `GET /uploads/:file` – hochgeladene Mediendateien abrufen

Die PIN schützt Änderungen im lokalen Netzwerk, ersetzt aber keine HTTPS- oder Benutzerverwaltung für eine öffentliche Installation. HomePiBoard sollte nicht direkt aus dem Internet erreichbar sein.

## Hinweise zu Web-Widgets

Viele Webseiten verbieten die Einbettung in fremde iframes. HomePiBoard zeigt während des Ladens einen Status und bietet bei langsamen Widgets eine Schaltfläche zum Neuladen. Sicherheitsrichtlinien der eingebetteten Webseite kann HomePiBoard nicht umgehen.

Die offenen Aufgaben stehen in [TODO.md](TODO.md).

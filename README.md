# HomePiBoard

Eine schlanke Digital-Signage-Anzeige für zu Hause. HomePiBoard ist für einen Raspberry Pi mit Chromium im Kiosk-Modus gedacht und benötigt im Betrieb keine Datenbank.

## Funktionen

- 24×14-Widget-Raster für Webseite, Kalender, Text, Bild, Diashow, Müllkalender & Media
- 🗑️ **Müllkalender-Widget:** Farbige Abfalltonnen (Restmüll, Bio, Papier, Gelber Sack, Glas) mit Dringlichkeits-Highlight
- 📻 **Webradio & Stream-Player ("Now Playing"):** Vorkonfigurierte deutsche Radiosender (1LIVE, SWR3, Antenne Bayern, Deutschlandfunk, WDR 2, Radio BOB!, etc.) & eigene Stream-URLs mit direkter Tonausgabe über Lautsprecher/Monitor, Touch-Play/Pause, Lautstärkeregler und animiertem Equalizer
- 🌙 **Automatischer Nachtmodus & Display-Dimmen:** Zeitgesteuertes Dimmen, Nacht-Uhr, Wake-on-Tap & Pixel-Shift (Burn-In-Schutz für 24/7-Betrieb)
- 🔔 **Smarte Webhook-Benachrichtigungen:** `POST /api/notify` mit Popup-Banner und integriertem Zweiklang-Türgong (synthetisiert via Web Audio API)
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

## 🚀 Schnellanleitung: Installation auf dem Raspberry Pi

### Schritt 1: Raspberry Pi OS Lite mit dem Raspberry Pi Imager flashen
1. Lade den offiziellen [Raspberry Pi Imager](https://www.raspberrypi.com/software/) herunter und starte ihn.
2. Wähle dein Raspberry-Pi-Modell aus (z. B. Raspberry Pi 4, 5 oder Zero 2W).
3. Als Betriebssystem wählst du:
   **Raspberry Pi OS (other) → Raspberry Pi OS Lite (64-bit)** *(oder 32-bit für ältere Modelle)*.
4. Klicke auf **Weiter** und öffne die **OS-Anpassungen (Zahnrad / Einstellungen)**:
   - **Hostname:** z. B. `raspberrypi`
   - **Benutzername & Passwort:** z. B. Benutzer `pi` und dein Wunschpasswort
   - **WLAN konfigurieren:** SSID und Passwort deines WLANs eintragen
   - **SSH aktivieren:** Reiter *Dienste* → *SSH aktivieren* (Passwort-Authentifizierung)
5. SD-Karte flashen, in den Raspberry Pi einstecken, per HDMI an den Bildschirm/TV anschließen und Strom anschließen.

### Schritt 2: Per SSH auf den Raspberry Pi verbinden
Öffne auf deinem PC, Mac oder Laptop ein Terminal (oder PowerShell unter Windows):

```bash
ssh pi@raspberrypi.local
```
*(Gib dein bei der Image-Erstellung vergebenes Passwort ein).*

### Schritt 3: System aktualisieren (apt update & upgrade) & curl / git installieren
Bringe das frische Raspberry Pi OS Lite auf den aktuellen Stand und installiere `curl` sowie `git`:

```bash
sudo apt update && sudo apt upgrade -y && sudo apt install -y curl git
```
*(Hinweis: Das `upgrade` stellt sicher, dass alle Treiber, Sicherheitsupdates und Systempakete auf dem neuesten Stand sind).*

### Schritt 4: Vollautomatische 1-Klick-Installation starten
Kopiere diesen One-Liner und drücke Enter:

```bash
curl -sSL https://raw.githubusercontent.com/Schello805/HomePiBoard/main/scripts/install.sh | bash
```

*Das Installationsskript erledigt alles vollautomatisch:*
- Installiert die leichtgewichtige X11-Kioskumgebung & Chromium für OS Lite
- Installiert Node.js 22 LTS
- Klont das Repository nach `~/HomePiBoard` und baut das optimierte Bundle
- Richtet den systemd-Dienst `homepiboard.service` für automatischen Start beim Booten ein
- Richtet den randlosen Kiosk-Vollbildmodus auf dem HDMI-Ausgang ein
- Versteckt den Mauszeiger nach 2 Sekunden Inaktivität

### Schritt 5: Raspberry Pi einmalig neustarten
Führe abschließend folgenden Befehl aus, um den automatischen HDMI-Kioskmodus zu starten:

```bash
sudo reboot
```

Der Pi startet neu, loggt sich automatisch ein und öffnet die HomePiBoard-Anzeige im Vollbildmodus auf deinem HDMI-Monitor!

---

### Ausgabe am Ende der Installation

Sobald die Installation durchgelaufen ist, zeigt dir das Terminal direkt alle wichtigen Verbindungsdaten an:

```text
===========================================================
  🎉 HomePiBoard wurde erfolgreich installiert!
===========================================================

  📺 HDMI-Anzeige:       http://localhost:4173/ (startet auf HDMI)
  🌐 Web-Anzeige:        http://192.168.1.50:4173/
  ⚙️ Admin-Bereich:      http://192.168.1.50:4173/admin

  🔑 Standard-PIN:       2468

===========================================================
  Tipp: Öffne http://192.168.1.50:4173/admin an deinem Laptop
  oder Smartphone, um deine Anzeige zu konfigurieren.
===========================================================
```

Nach einem Neustart (`sudo reboot`) startet die HDMI-Anzeige automatisch im Vollbild. Ausführliche Tipps zu HDMI-Auflösungen und nächtlicher CEC-Abschaltung findest du in [docs/raspberry-pi-hdmi.md](docs/raspberry-pi-hdmi.md).

## Updates durchführen

Wenn neue Funktionen oder Fehlerbehebungen für HomePiBoard erscheinen, kannst du deine Installation auf dem Raspberry Pi in Sekundenschnelle aktualisieren:

### Option A: Mit dem automatischen Update-Skript (Empfohlen)

Verbinde dich per SSH mit deinem Pi und führe das integrierte Skript aus:

```bash
cd ~/HomePiBoard
./scripts/update.sh
```

*Das Skript erledigt automatisch alles Nötige:*
- Lädt die neuesten Änderungen via `git pull` herunter
- Installiert eventuell neue Paket-Abhängigkeiten (`npm install`)
- Kompiliert das Frontend neu (`npm run build`)
- Startet den Hintergrunddienst `homepiboard.service` unterbrechungsfrei neu

### Option B: Manuell Schritt für Schritt

Falls du das Update manuell ausführen möchtest:

```bash
cd ~/HomePiBoard
git pull
npm install
npm run build
sudo systemctl restart homepiboard
```

### Option C: Raspberry Pi OS & Chromium-Updates
Um zusätzlich das Linux-Betriebssystem und den Chromium-Browser aktuell zu halten:

```bash
sudo apt update && sudo apt upgrade -y
```


- `GET /api/settings` – aktuelle Konfiguration lesen
- `GET /api/system` – Hardware-, Netzwerk- und System-Telemetrie lesen (CPU-Temp, RAM, IP, Uptime)
- `POST /api/auth` – Admin-PIN prüfen
- `PUT /api/settings` – Konfiguration mit Header `x-admin-pin` speichern
- `PUT /api/admin-pin` – Admin-PIN mit aktueller PIN im Header `x-admin-pin` ändern
- `POST /api/upload` – Bilddatei hochladen (PNG, JPG, WebP, GIF, SVG bis 5 MB, erfordert `x-admin-pin`)
- `GET /uploads/:file` – hochgeladene Mediendateien abrufen
- `POST /api/notify` – Live-Push-Benachrichtigung mit akustischem Gong senden (`{"title": "...", "message": "...", "sound": "doorbell"|"chime"|"alert", "duration": 10, "image": "..."}`)
- `GET /api/notify/stream` – Server-Sent Events (SSE) Stream für Push-Benachrichtigungen
- `POST /api/notify/clear` – Aktive Benachrichtigung sofort schließen
- `POST /api/media` & `GET /api/media` – Aktuelle Musikwiedergabe übertragen (`{"title": "...", "artist": "...", "album": "...", "isPlaying": true}`)

Die PIN schützt Änderungen im lokalen Netzwerk, ersetzt aber keine HTTPS- oder Benutzerverwaltung für eine öffentliche Installation. HomePiBoard sollte nicht direkt aus dem Internet erreichbar sein.

## Hinweise zu Web-Widgets

Viele Webseiten verbieten die Einbettung in fremde iframes. HomePiBoard zeigt während des Ladens einen Status und bietet bei langsamen Widgets eine Schaltfläche zum Neuladen. Sicherheitsrichtlinien der eingebetteten Webseite kann HomePiBoard nicht umgehen.

Die offenen Aufgaben stehen in [TODO.md](TODO.md).

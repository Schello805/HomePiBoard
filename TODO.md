# HomePiBoard TODO

## Erledigt

- [x] Schlanke Vite-/TypeScript-Projektbasis anlegen
- [x] Kleine Kopfzeile mit Ort, Datum und Uhrzeit bauen
- [x] Kalendertermine aus dem Header weglassen
- [x] Widget-Raster für die Anzeige umsetzen
- [x] Web-Widget als iframe-Platzhalter vorbereiten
- [x] URL, Bezeichnung und Widget-Größe konfigurierbar machen
- [x] Einstellungen lokal im Browser speichern
- [x] Separate Admin-Seite unter `/admin` ergänzen
- [x] Mehrere Web-Widgets mit eigenen Titeln, URLs und Größen verwalten
- [x] Widget-Breite und -Höhe frei über den Resize-Griff verändern
- [x] Feineres 24×8-Resize-Raster für präzise Widget-Größen ergänzen
- [x] Widget-Typen für Webseite, Kalender, Text und Bild ergänzen
- [x] Optionales Wetter-/Temperaturmodul für den kleinen Header ergänzen
- [x] Mobile Darstellung und Raspberry-taugliche CSS-Struktur ergänzen
- [x] Anwendung in Settings-, Anzeige-, Admin- und Widget-Module aufteilen
- [x] Automatisierte Tests für Migration, Offline-Speicher, Widgets und Server-API ergänzen
- [x] Kiosk-Raster auf die verfügbare Bildschirmhöhe begrenzen
- [x] Admin-Ansicht mit PIN-Schutz absichern
- [x] Konfiguration serverseitig in `data/settings.json` speichern
- [x] Ladezustand und manuelles Neuladen für iframe-Widgets ergänzen
- [x] Systemd- und Chromium-Autostart dokumentieren

- [x] Drag-and-drop zum Sortieren der Widget-Reihenfolge ergänzen
- [x] Weitere kleine Header-Module ergänzen: Netzwerkstatus
- [x] Diashow-Widget ergänzen
- [x] Automatische iframe-Aktualisierung in konfigurierbaren Intervallen ergänzen
- [x] Freies Widget-Resizing über Eckgriff mit 24-Spalten-Raster-Fluss
- [x] Platzsparender Editmode mit identischem Kiosk-Grid und zentrierter Topbar
- [x] Modal-Dialog für Widget-Einstellungen zur visuellen Entlastung des Arbeitsbereichs
- [x] 4-Wege-Positionierung (←, →, ↑, ↓) und expliziter Zeilenumbruch ("In neuer Zeile beginnen")
- [x] Papierkorb-Löschfunktion im Widget-Header und im Einstellungsdialog
- [x] Direkter Bilder-Upload (PNG, JPG, WebP, GIF, SVG bis 5 MB) mit Serverablage
- [x] Checkbox zur optionalen Anzeige des Widget-Titels in der Kiosk-Ansicht
- [x] Raspberry Pi Live-Telemetrie-API (`/api/system`) für CPU-Temperatur, RAM, CPU-Load, IP und Uptime
- [x] System- & Display-Einstellungsdialog im Admin-Bereich (`⚙ System & HDMI`)
- [x] Einstellbare Display-Skalierung (80%–150%) für Fernseher und Wand-Displays
- [x] Erkennung und Anzeige der HDMI-Bildschirmauflösung
- [x] Automatisches Ausblenden des Mauszeigers im HDMI-Kioskmodus nach 2 Sekunden
- [x] Einstellbare Zeitzone, Sprache/Datumsformat und Sekundenanzeige
- [x] Kiosk-Autostart-Skript (`scripts/kiosk.sh`) und systemd-Service (`scripts/homepiboard.service`)
- [x] Ausführliche Dokumentation für Raspberry Pi HDMI-Setup (`docs/raspberry-pi-hdmi.md`)
- [x] Kiosk lädt automatisch neu bei gespeicherten Änderungen, Server-Neustart/Update und nachts um 04:00
- [x] Wetter im Header alle 20 Minuten aktualisieren
- [x] Kamera-Proxy nur für gespeicherte Kamera-Widgets, Limit paralleler ffmpeg-Prozesse, keine Zugangsdaten in Fehlermeldungen
- [x] Optionaler API-Token (`HOMEPIBOARD_API_TOKEN`) für `/api/notify` und `/api/media`
- [x] Defekte `settings.json` wird gesichert statt still überschrieben
- [x] Vorgebautes Frontend per GitHub Actions (Release `build-latest`), lokaler Build nur noch als Fallback
- [x] Netzwerkstatus prüft `/api/health` statt der kompletten Konfiguration
- [x] Fehlende Systempakete (z. B. Touch-Treiber libinput) werden beim Update nachinstalliert
- [x] CI: Tests und Build bei jedem Push (GitHub Actions)
- [x] Tests rufen nicht mehr das echte Audio-Skript (sudo) auf

## Als Nächstes

- [ ] USB-Touchmonitor am Raspberry Pi 3B zum Laufen bringen (Diagnose: `lsusb`, `vcgencmd get_throttled`, `/proc/bus/input/devices`, Xorg-Log)
- [ ] Kiosk-Autostart auf einem echten Raspberry Pi testen
- [ ] Netzwerk- und Offline-Verhalten prüfen
- [ ] Produktionsbuild auf dem Raspberry Pi testen

## Optimierungen (Backlog aus Code-Review)

### Performance (Pi 3B)
- [ ] Ein gemeinsamer ffmpeg-Prozess pro Kamera statt einer pro Zuschauer; MJPEG-fps reduzieren
- [ ] gzip/Brotli-Kompression bzw. vorkomprimierte Assets für statische Dateien
- [ ] ICY-Metadaten-Cache begrenzen (wächst aktuell unbegrenzt)
- [ ] Verwaiste Uploads in `data/uploads` aufräumen (nicht mehr referenzierte Bilder löschen)

### Wartbarkeit
- [ ] `server.mjs` (~1400 Zeilen, lange if-Kette) in Routen-Module aufteilen
- [ ] `admin.ts` und `settings-page.ts` (je ~1400 Zeilen) in kleinere Module zerlegen
- [ ] `style.css` (~3200 Zeilen) nach Bereichen aufteilen (Display, Admin, Settings, Widgets)
- [ ] Versionsnummer pflegen (aktuell `0.0.0`) und Changelog/Releases einführen
- [ ] Linting (ESLint) und Formatierung in CI ergänzen

### Sicherheit
- [ ] Standard-PIN `0000`: nach der Installation Hinweis anzeigen bzw. PIN-Änderung erzwingen
- [ ] Kamera-Zugangsdaten (rtsp://user:pass@…) sind über `GET /api/settings` öffentlich lesbar – serverseitig maskieren und Kamera per Widget-ID proxyen
- [ ] API-Token in den Einstellungen generieren/anzeigen statt nur per Umgebungsvariable
- [ ] Kamera-Vorschau im Admin für noch nicht gespeicherte Widgets (z. B. kurzlebiger Vorschau-Token)



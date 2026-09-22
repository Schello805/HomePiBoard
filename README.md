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

Für den Raspberry Pi kann der erzeugte `dist/`-Ordner mit einem kleinen statischen Webserver ausgeliefert werden. Chromium startet anschließend die Anzeige im Vollbild:

```bash
chromium-browser --kiosk http://localhost:4173
```

Die Einstellungen werden in der aktuellen Browser-Installation gespeichert. Unter `/admin` können Ort, Wetterort, iframe-URLs und Widget-Größen angepasst werden. Das optionale Wettermodul nutzt Open-Meteo und benötigt Internetzugang.

Die offenen Aufgaben stehen in [TODO.md](TODO.md).

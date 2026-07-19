# Neon Channel VR

Ein modernes VR-Ping-Pong-Spiel für **Meta Quest 3**, umgesetzt mit **Three.js**, **WebXR** und Vite. Das Spiel läuft direkt im Meta Quest Browser und wird automatisch über GitHub Pages veröffentlicht.

## Aktuelle Funktionen

- Futuristischer, vollständig verbundener Neonkanal ohne wiederkehrende Wandmuster
- Langsam pulsierende und farbwechselnde Neonrahmen
- Animierter Nebel-/Weltraumhintergrund mit mehreren dezenten Sternenebenen
- KI-Gegner mit drei Schwierigkeitsgraden
- Dynamische Ballgeschwindigkeit bei längeren Ballwechseln
- Ballfarbe, Leuchtkraft und Schweif reagieren auf die aktuelle Geschwindigkeit
- Trefferpartikel, Haptik und Sound
- Hochauflösendes VR-Menü mit großen Klickflächen
- Exakter Controller-Pointer mit sichtbarem Zielpunkt am Menü
- Einstellbare Raumtiefe, Breite und Höhe
- Frei beweglicher Spieler oder optionaler Fix-Modus
- Schläger-Rekalibrierung durch gehaltenes R2

## Quest-3-Steuerung

| Eingabe | Funktion |
| --- | --- |
| Linker Thumbstick horizontal | Nach links und rechts bewegen |
| Linker Thumbstick vertikal | Nach oben und unten bewegen |
| Rechter Controller | Schläger räumlich bewegen und drehen |
| R2 halten und loslassen | Schläger in bequemer Controllerhaltung neu justieren |
| A-Taste | Start-/Pausemenü öffnen beziehungsweise schließen |
| R2 im Menü | Markierte Schaltfläche anklicken |

Im **Fix-Modus** wird der virtuelle Spieler automatisch horizontal und vertikal in der Raummitte gehalten.

## Startmenü

Das Menü erscheint etwa 2,65 Meter vor dem Spieler. Der Pointer zeigt mit einem sichtbaren Zielring exakt auf die aktuelle Einschlagsposition. Einstellbar sind:

- Raumtiefe
- Raumbreite
- Raumhöhe
- KI-Schwierigkeit
- Fix-Modus

## Desktop-Test

- Maus: Schläger bewegen
- A/D oder Pfeiltasten: links/rechts
- W/S oder Pfeiltasten: hoch/runter
- M oder Escape: Menü
- F: Fix-Modus
- R: Match neu starten

## Lokal starten

```bash
npm install
npm run dev
```

Produktions-Build:

```bash
npm run build
npm run preview
```

## Meta Quest 3

1. Den **Meta Quest Browser** öffnen.
2. `https://kevni92.github.io/vr-test/` aufrufen.
3. **ENTER VR** auswählen.
4. Die WebXR-Berechtigung bestätigen.
5. Im Startmenü mit dem rechten Controller zielen und mit R2 klicken.

## Veröffentlichung

Der Workflow `.github/workflows/deploy-pages.yml` baut bei jedem Push auf `main` die Anwendung und veröffentlicht den Ordner `dist` über GitHub Pages.

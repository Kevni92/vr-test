# Neon Channel VR

Ein modernes VR-Ping-Pong-Spiel für **Meta Quest 3**, umgesetzt mit **Three.js**, **WebXR** und Vite. Das Spiel läuft direkt im Meta Quest Browser und wird automatisch über GitHub Pages veröffentlicht.

## Spielidee

Du stehst in einem futuristischen, rechteckigen Kanal. Gegenüber befindet sich in etwa 8,7 Metern Entfernung ein KI-Bot mit eigenem Schläger. Der Ball fliegt frei durch den Kanal und prallt an Seitenwänden, Boden und Decke ab.

## Funktionen

- Seitliche Bewegung des Spielers; keine künstliche Vorwärts-, Höhen- oder Tiefenbewegung
- VR-Schläger am rechten Quest-Controller
- Ballkollisionen mit Position, Ausrichtung und Geschwindigkeit des Schlägers
- Haptisches Feedback beim eigenen Treffer
- KI-Gegner mit Reaktionszeit, Vorhersage und leichter Ungenauigkeit
- Zunehmendes Balltempo während längerer Ballwechsel
- Neon-Kanal, Ballspur, Geräusche und räumliche Anzeigetafel
- Match bis 7 Punkte mit mindestens 2 Punkten Vorsprung
- Desktop-Vorschau mit Maus und Tastatur

## Quest-3-Steuerung

| Eingabe | Funktion |
| --- | --- |
| Linker Thumbstick | Nach links und rechts bewegen |
| Rechter Controller | Schläger räumlich bewegen und drehen |
| A-Taste | Match neu starten |

Die körperliche Kopfbewegung bleibt durch das normale Quest-Tracking erhalten. Die künstliche Fortbewegung des Spielers ist ausschließlich seitlich.

## Desktop-Test

- Maus: Schläger bewegen
- A/D oder Pfeiltasten: seitlich bewegen
- R oder Leertaste: Match neu starten

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
5. Mit dem linken Stick seitlich bewegen und den rechten Controller als Schläger verwenden.

## Veröffentlichung

Der Workflow `.github/workflows/deploy-pages.yml` baut bei jedem Push auf `main` die Anwendung und veröffentlicht den Ordner `dist` über GitHub Pages.

WebXR benötigt HTTPS. GitHub Pages stellt diesen sicheren Kontext automatisch bereit.

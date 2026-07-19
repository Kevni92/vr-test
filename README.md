# Neon Channel VR

Ein futuristisches VR-Ping-Pong-Spiel für **Meta Quest 3**, umgesetzt mit **Three.js**, **WebXR** und Vite. Das Spiel läuft direkt im Meta Quest Browser und wird automatisch über GitHub Pages veröffentlicht.

## Funktionen

- Rechteckiger Sci-Fi-Kanal mit Neonrahmen, transparenten Seitenflächen und animiertem Energieportal
- Dezentes Starfield außerhalb des Spielfelds
- Seitliche Bewegung; keine künstliche Vorwärts- oder Höhenbewegung
- VR-Schläger am rechten Quest-Controller
- R2-Rekalibrierung für eine bequeme individuelle Schlägerausrichtung
- Vollständig pausierendes VR-Menü etwa 2,75 Meter vor dem Spieler
- Pointer-Bedienung des Menüs mit dem rechten Controller und R2
- Einstellbare Raumtiefe, Raumbreite, Raumhöhe und KI-Schwierigkeit
- Ballkollisionen mit Position, Winkel und Geschwindigkeit des Schlägers
- Dynamisch zunehmendes Balltempo während langer Ballwechsel
- Geschwindigkeitsabhängige Ballfarbe, Leuchtintensität und Schweif
- Partikeleffekte und haptisches Feedback bei Treffern
- Match bis 7 Punkte mit mindestens 2 Punkten Vorsprung

## Quest-3-Steuerung

| Eingabe | Funktion |
| --- | --- |
| Linker Thumbstick | Nach links und rechts bewegen |
| Rechter Controller | Schläger räumlich bewegen und drehen |
| R2 im Spiel halten | Schläger in neutraler Ausrichtung fixieren; Controller bequem halten |
| R2 loslassen | Neue Schlägerausrichtung speichern |
| A | Pause- und Einstellungsmenü öffnen |
| R2 im Menü | Angezeigte Schaltfläche anklicken |

Beim Start einer VR-Sitzung bleibt das Spiel im Menü pausiert. Erst **SPIEL STARTEN** aktiviert Ball und KI.

## Menüeinstellungen

- Raumtiefe: 10,8 / 12,8 / 15,2 Meter
- Raumbreite: 4,2 / 5,0 / 5,8 Meter
- Raumhöhe: 2,9 / 3,45 / 4,0 Meter
- KI: Entspannt / Normal / Experte

## Desktop-Test

- Maus: Schläger bewegen
- A/D oder Pfeiltasten: seitlich bewegen
- M oder Escape: Menü öffnen
- Leertaste: Menü schließen und starten
- R: Match neu starten

## Meta Quest 3

1. Den **Meta Quest Browser** öffnen.
2. `https://kevni92.github.io/vr-test/` aufrufen.
3. **ENTER VR** auswählen.
4. Im räumlichen Menü die gewünschten Einstellungen wählen.
5. **SPIEL STARTEN** mit dem Pointer und R2 anklicken.
6. Bei Bedarf R2 im Spiel halten, den Controller bequem ausrichten und R2 loslassen.

## Veröffentlichung

Der Workflow `.github/workflows/deploy-pages.yml` baut bei jedem Push auf `main` die Anwendung und veröffentlicht `dist` über GitHub Pages.

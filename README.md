# Neon Channel VR

Ein futuristisches VR-Ping-Pong-Spiel für **Meta Quest 3**, umgesetzt mit **Three.js**, **WebXR** und Vite. Das Spiel läuft direkt im Meta Quest Browser und wird automatisch über GitHub Pages veröffentlicht.

## Funktionen

- Durchgehend verbundener rechteckiger Neonrahmen ohne wiederkehrende Wandmuster
- Langsam wandernde Farben sowie Fade- und Pulsanimationen an allen Rahmenkanten
- Lebendiger, aber zurückhaltender Weltraumhintergrund mit Nebeln, Sternen und Ringplanet
- Horizontale und vertikale künstliche Bewegung über den linken Thumbstick
- Optionaler Fix-Modus, der die virtuelle Kopfhöhe automatisch in der Raummitte hält
- VR-Schläger am rechten Quest-Controller
- R2-Rekalibrierung für eine bequeme individuelle Schlägerausrichtung
- Vollständig pausierendes VR-Menü etwa 2,75 Meter vor dem Spieler
- Einstellbare Raumtiefe, Raumbreite, Raumhöhe und KI-Schwierigkeit
- Dynamisch zunehmendes Balltempo, geschwindigkeitsabhängige Farbe und Leuchtschweif
- Partikeleffekte und haptisches Feedback bei Treffern
- Match bis 7 Punkte mit mindestens 2 Punkten Vorsprung

## Quest-3-Steuerung

| Eingabe | Funktion |
| --- | --- |
| Linker Thumbstick horizontal | Nach links und rechts bewegen |
| Linker Thumbstick vertikal | Nach oben und unten bewegen |
| Rechter Controller | Schläger räumlich bewegen und drehen |
| R2 im Spiel halten | Schläger neu ausrichten |
| R2 loslassen | Neue Schlägerausrichtung speichern |
| A | Pause- und Einstellungsmenü öffnen oder schließen |
| R2 im Menü | Angezeigte Schaltfläche anklicken |

## Fix-Modus

Der Fix-Modus wird im räumlichen Menü ein- oder ausgeschaltet. Ist er aktiv, wird die virtuelle Kopfhöhe weich auf die Mitte der gewählten Raumhöhe zentriert. Die Bewegung nach links und rechts bleibt weiterhin möglich.

## Menüeinstellungen

- Raumtiefe: 10,8 / 12,8 / 15,2 Meter
- Raumbreite: 4,2 / 5,0 / 5,8 Meter
- Raumhöhe: 2,9 / 3,45 / 4,0 Meter
- KI: Entspannt / Normal / Experte
- Fix-Modus: An / Aus

## Desktop-Test

- Maus: Schläger bewegen
- A/D oder Pfeiltasten links/rechts: seitlich bewegen
- W/S oder Pfeiltasten hoch/runter: Höhe verändern
- F: Fix-Modus umschalten
- M oder Escape: Menü öffnen
- Leertaste: Menü schließen und starten
- R: Match neu starten

## Meta Quest 3

1. Den **Meta Quest Browser** öffnen.
2. `https://kevni92.github.io/vr-test/` aufrufen.
3. **ENTER VR** auswählen.
4. Im räumlichen Menü die gewünschten Einstellungen wählen.
5. **SPIEL STARTEN** mit Pointer und R2 anklicken.

## Veröffentlichung

Der Workflow `.github/workflows/deploy-pages.yml` baut bei jedem Push auf `main` die Anwendung und veröffentlicht `dist` über GitHub Pages. Vor dem Vite-Build wird die aktuelle Spielszene automatisch aus den versionierten Quellsegmenten zusammengesetzt.

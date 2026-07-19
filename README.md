# Quest 3 WebXR Mini-Baukasten

Ein minimalistischer räumlicher Editor für **Meta Quest 3**, umgesetzt mit **Three.js**, **WebXR** und Vite. Die Anwendung läuft direkt im Meta Quest Browser; eine native APK ist für dieses Webprojekt nicht nötig.

## Funktionen

- 3D-Baumenü mit Würfel, Quader, Kugel, Zylinder, Pyramide und Dreiecksprisma
- Freies Platzieren im Raum über den rechten Controllerstrahl
- Greifen und Verschieben bereits platzierter Formen
- Drehen, Skalieren, Löschen und Rückgängig
- Einfache Bewegung mit dem linken Thumbstick
- Desktop-Testleiste für Tests ohne Headset
- Automatische Veröffentlichung über GitHub Pages

## Quest-3-Steuerung

| Eingabe | Funktion |
| --- | --- |
| A (rechter Controller) | Baumenü öffnen/schließen |
| Rechter Thumbstick im Menü | Form auswählen |
| R2 / rechter Trigger | Form platzieren bzw. Menüauswahl bestätigen |
| Rechter Grip | Anvisiertes Objekt greifen/loslassen |
| Rechter Stick horizontal | Vorschau oder gehaltenes Objekt drehen |
| Rechter Stick vertikal | Platzierungsabstand ändern bzw. gehaltenes Objekt kippen |
| B | Größe der nächsten Form wechseln |
| Linker Stick | Bewegen |
| X | Anvisiertes Objekt löschen |
| Y | Letzte Platzierung rückgängig machen |

> Die Meta-Systemtaste ist für das Betriebssystem reserviert und wird WebXR-Anwendungen nicht bereitgestellt. Deshalb verwendet das Projekt die A-Taste für das eigene Menü.

## Lokal starten

```bash
npm install
npm run dev
```

Für einen produktiven Test:

```bash
npm run build
npm run preview
```

WebXR benötigt einen sicheren Kontext. Lokal funktioniert `localhost`; auf der Quest wird die von GitHub Pages bereitgestellte HTTPS-Adresse verwendet.

## GitHub Pages

Der Workflow `.github/workflows/deploy-pages.yml` baut bei jedem Push auf `main` die Vite-Anwendung und veröffentlicht `dist` über GitHub Pages.

Falls Pages beim ersten Lauf noch nicht freigeschaltet ist:

1. Repository **Settings → Pages** öffnen.
2. Unter **Build and deployment** als Quelle **GitHub Actions** wählen.
3. Den Workflow unter **Actions → Deploy GitHub Pages** erneut starten.

Danach lautet die Standardadresse:

`https://kevni92.github.io/vr-test/`

## Auf der Meta Quest 3 öffnen

1. Quest 3 mit dem WLAN verbinden.
2. **Meta Quest Browser** öffnen.
3. `https://kevni92.github.io/vr-test/` aufrufen.
4. Unten auf **ENTER VR** drücken.
5. Die WebXR-Abfrage bestätigen und die Controller verwenden.

## Technischer Hinweis zum Meta SDK

Das native **Meta XR SDK** richtet sich an native Anwendungen, beispielsweise Unity-/Unreal-Projekte oder Android-Apps. Eine Website nutzt auf der Quest stattdessen die vom Meta Quest Browser bereitgestellte **WebXR-Schnittstelle**. Three.js bindet diese Schnittstelle über `WebXRManager`, `VRButton` und die standardisierten XR-Controllerdaten ein.

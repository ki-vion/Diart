# Diart — PDF-Angebot zu Excel

Offline-fähige **Progressive Web App (PWA)** zum Extrahieren von Artikelpositionen aus **Text-PDFs** (Angebote/Rechnungen) und Export als Excel im Format „Materialliste mit VK Preis“ (inkl. Aufschlag und VK-Formeln).

Läuft im Browser auf **Windows-PC** und **iPad** — ohne Server, ohne `.exe`.

## Schnellstart

**Voraussetzungen:** [Node.js](https://nodejs.org/) 20+

```bash
cd desktop
npm install
npm run dev
```

Die App ist unter der von Vite ausgegebenen URL erreichbar (typisch `http://localhost:5173`).

### Produktion / Offline testen

```bash
cd desktop
npm run build
npm run preview
```

Nach dem ersten Laden werden App-Shell, MuPDF-WASM und Assets per Service Worker gecacht — danach auch ohne Netzwerk nutzbar.

### Auf dem iPad

1. App im Safari öffnen (gehostete `desktop/dist/`-Dateien oder `npm run preview` im lokalen Netzwerk).
2. **Teilen → Zum Home-Bildschirm** — installiert die PWA.
3. PDF auswählen, konvertieren, Excel über **Download** speichern (z. B. in „Dateien“).

### Tests

```bash
cd desktop
npm run test:run
```

### Unterstützte Layouts

`kan_ifb`, `norit_rechnung`, `rk_stark`, `laier_van`

### Technik

| Schritt | Modul |
|--------|--------|
| PDF → Textzeilen | [MuPDF.js](https://www.npmjs.com/package/mupdf) (WASM) |
| Layout + Positionen | TypeScript (`desktop/src/extractor/`) |
| Excel-Export | ExcelJS (`desktop/src/export/`) |

**Hinweis:** MuPDF.js steht unter **AGPL** — für kommerzielle Nutzung ggf. Lizenz bei Artifex klären.

Beispiel-PDFs zum Testen liegen in `Vorlagen/`.

## Dokumentation

- Spezifikation: `docs/superpowers/specs/2026-05-28-pwa-offline-mupdf-design.md`
- Implementierungsplan: `docs/superpowers/plans/2026-05-28-pwa-offline-mupdf-implementation.md`

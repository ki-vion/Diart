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

Die App lädt PDFs als **`PdfStructured`** (MuPDF `asText` + Wörter mit x/y), erkennt ein **Profil** (`detectProfile`) und extrahiert mit dem passenden Parser (Orchestrator unter `desktop/src/extractor/`). Unbekannte PDFs nutzen den generischen Fallback `table_geometry`.

```bash
cd desktop
npm run smoke:extract   # Schnelltest aller PDFs in Vorlagen/
```

### MuPDF erkunden (Entwicklung)

```bash
cd desktop
npm run explore:mupdf
# optional nur ein PDF:
npm run explore:mupdf -- "../Vorlagen/RK - Fermacell.pdf"
```

Ausgabe: `desktop/exploration-output/<pdf-name>/`

| Datei | Zweck |
|--------|--------|
| `page-XX-words.tsv` | Jedes **Zeichen** mit `x`, `y` (Rohdaten) |
| `page-XX-lines.tsv` | Jede **logische Zeile** mit `xMin`, `xMax` (Y-Cluster ±3 px) |
| `page-XX-cells.tsv` | Zeile + **Spaltenzuordnung** (Pos, Artikel, Bezeichnung, Menge, …) |
| `profile.json` | Erkanntes Profil + **X-Spaltenfenster** (`xMin`/`xMax` pro Rolle) |
| `page-XX-asText.txt` | MuPDF-Fließtext (wie der alte Parser) |

**X-Werte prüfen:** In Excel/LibreOffice `page-01-lines.tsv` öffnen → nach `y` sortieren → bei Tabellenzeilen `xMin`/`xMax` mit `profile.json` → `columnWindows` vergleichen. Passt der Text nicht in die Spalte, `defaultWindows` in `desktop/src/extractor/pipeline/templates.ts` anpassen.

**Blöcke / extrahierte Positionen prüfen:**

```bash
cd desktop
npm run explore:blocks
```

Erzeugt zusätzlich `blocks.json` (Ankerzeilen, `cells` pro Zeile, finale `items`) und pro Seite `page-XX-cells.tsv` falls ein RK-/Norit-Profil erkannt wurde.

Pipeline-Schnelltest auf allen PDFs in `Vorlagen/`:

```bash
cd desktop
npm run smoke:extract
```

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

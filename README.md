# Diart — PDF-Angebot zu Excel

Offline-fähige **Progressive Web App (PWA)** zum Extrahieren von Artikelpositionen aus **Text-PDFs** (Angebote/Rechnungen) und Export als Excel im Format „Materialliste mit VK Preis“ (inkl. Aufschlag und VK-Formeln).

Läuft im Browser auf **Windows-PC** und **iPad** — ohne Server, ohne Installation als `.exe`.

## Web-App (PWA)

**Voraussetzungen:** [Node.js](https://nodejs.org/) 20+

```bash
cd desktop
npm install
npm run dev
```

Die App ist unter der URL ausgegeben von Vite erreichbar (typisch `http://localhost:5173`).

### Produktion / Offline testen

```bash
cd desktop
npm run build
npm run preview
```

Nach dem ersten Laden werden App-Shell, MuPDF-WASM und Assets per Service Worker gecacht — danach auch ohne Netzwerk nutzbar.

### Auf dem iPad

1. App im Safari öffnen (nach `npm run build` + Hosting der `desktop/dist/`-Dateien, oder über `npm run preview` im lokalen Netzwerk).
2. **Teilen → Zum Home-Bildschirm** — installiert die PWA.
3. PDF auswählen, konvertieren, Excel über **Download** speichern (z. B. in „Dateien“).

### Tests

```bash
cd desktop
npm run test:run
```

### Unterstützte Layouts

`kan_ifb`, `norit_rechnung`, `rk_stark`, `laier_van`

### Technik (kurz)

| Schritt | Modul |
|--------|--------|
| PDF → Textzeilen | [MuPDF.js](https://www.npmjs.com/package/mupdf) (WASM) |
| Layout + Positionen | TypeScript (`desktop/src/extractor/`) |
| Excel-Export | ExcelJS (`desktop/src/export/`) |

**Hinweis:** MuPDF.js steht unter **AGPL** — für kommerzielle Nutzung ggf. Lizenz bei Artifex klären.

---

## Python-Extractor (CLI, Referenz)

Der ursprüngliche Extractor bleibt als Referenz und für Tests im Ordner `extractor/`:

```bash
cd extractor
pip install -r requirements.txt
python -m pytest -v
python main.py --input "../Vorlagen/KAN_1060020 EK Preis IFB.pdf" --output "./tests/_out/angebot.xlsx" --aufschlag 0.2
```

**Parameter:**

- `--input` — PDF-Pfad
- `--output` — Ziel-`.xlsx`
- `--aufschlag` — Dezimalfaktor (z. B. `0.2` = +20 %)

---

## Dokumentation

- Spezifikation (PWA): `docs/superpowers/specs/2026-05-28-pwa-offline-mupdf-design.md`
- Implementierungsplan (PWA): `docs/superpowers/plans/2026-05-28-pwa-offline-mupdf-implementation.md`
- Ursprünglicher Plan (Desktop/Tauri): `docs/superpowers/plans/2026-05-21-pdf-angebot-zu-excel.md`

## Legacy: Tauri Desktop

Die frühere Windows-Desktop-Variante (`desktop/src-tauri/`, Sidecar, `npm run tauri build`) ist durch die PWA abgelöst. Der Tauri-Code kann im Repo noch vorhanden sein, wird aber nicht mehr für die Auslieferung genutzt.

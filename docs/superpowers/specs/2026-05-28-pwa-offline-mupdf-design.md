# Diart als PWA (offline) — PDF→Excel im Browser (MuPDF-WASM)

## Ziel

Das bestehende Projekt soll statt als Windows Desktop-App (Tauri `.exe`) als **Progressive Web App (PWA)** ausgeliefert werden, sodass es **lokal/offline** auf **Windows-PC** und **iPad (Safari)** nutzbar ist.

Kernfunktion bleibt: **Text-PDFs** (Angebote/Rechnungen) werden verarbeitet, **Artikelpositionen** extrahiert und als **Excel-Datei** exportiert, die im Look & Feel der bestehenden Vorlage „Materialliste mit VK Preis“ entspricht (inkl. Formeln/Spalten).

## Nicht-Ziele

- Kein Server / keine Cloud / kein lokales Backend.
- Keine OCR (nur „echte“ Text-PDFs).
- Keine direkte Speicherung in feste Pfade/Ordner wie im Desktop (Browser-Download/Share statt Dateipfad-Output).
- Keine Weiterführung des Tauri Sidecar-Konzepts oder `src-tauri` als Produktbestandteil.

## Ausgangslage (Ist-Zustand)

- UI: `desktop/` ist eine Vue+Vite+TypeScript App, aktuell über Tauri gebundled.
- Desktop-Integration: `desktop/src-tauri/src/commands/convert.rs` ruft in Release ein Sidecar (`extractor-sidecar`) oder in Dev das Python-Skript `extractor/main.py` auf.
- Extractor: `extractor/` ist Python (PyMuPDF/fitz) mit layout-spezifischen Strategien (`kan_ifb`, `norit_rechnung`, `rk_stark`, `laier_van`).
- Excel: Python `openpyxl` erzeugt Workbook inkl. Formeln (VK/gesamt).

## Ziel-Architektur (Soll-Zustand)

### Überblick

Die PWA besteht aus drei technischen Schritten:

1. **PDF-Parsing in WASM**: MuPDF (als WASM/JS binding) extrahiert Text aus dem PDF.
2. **Extraktion/Mapping in TypeScript**: Layout-Erkennung + Parsing der Line-Items aus den extrahierten Textzeilen (Port der bestehenden Python-Strategien).
3. **Excel-Export in TypeScript**: Erstellung einer `.xlsx`, die der bestehenden Vorlage entspricht (Styles/Spaltenbreiten/Number-Formats/Formeln).

### Begründung der Aufteilung

- **MuPDF-WASM** deckt zuverlässig „PDF → Text“ ab und läuft offline im Browser.
- Die heutige Extraktion ist größtenteils „Text-Zeilen + Regex + Heuristiken“ (z. B. `KanIfbStrategy`), daher ist ein zusätzlicher eigener Rust-WASM Extractor nicht erforderlich.
- Excel-Export im Browser ist am stabilsten über eine JS/TS Bibliothek (z. B. `exceljs`) und vermeidet komplexe WASM Dateisystem-/Download-Fragen.

## Module & Verantwortlichkeiten

### `desktop/` (PWA App)

#### `src/pdf/mupdf.ts`

Verantwortung: PDF-Datei (Browser `File`) in **Text-Zeilen** pro Seite umwandeln.

Vorgeschlagene API:

- `extractPdfLines(file: File): Promise<PdfText>`

Datentyp:

- `type PdfText = { sourceFileName?: string; pages: { index: number; lines: string[] }[] }`

**Anforderung:** Die resultierenden `lines` müssen so kompatibel wie möglich zu Python `page.get_text().splitlines()` sein, weil die Strategien darauf aufbauen.

#### `src/extractor/` (TypeScript Port der Python-Logik)

- `models.ts`
  - `LineItem`
  - `ExtractionResult`
- `detector.ts`
  - Auswahl der passenden Strategy (analog `extractor/detector.py`)
- `strategies/*.ts`
  - Port der vorhandenen Strategien:
    - `kan_ifb.ts`
    - `norit_rechnung.ts`
    - `rk_stark.ts`
    - `laier_van.ts`
- `utils.ts`
  - `parseDeNumber` (analog Python)
  - Normalisierung (Whitespace, Tausender-Trennzeichen, etc.)

Vorgeschlagene API:

- `runExtraction(pdf: PdfText): ExtractionResult`

Fehlerfall:

- Bei unbekanntem Layout: Throw oder `ok=false` mit `error.code = "LAYOUT_UNKNOWN"`.

#### `src/export/excel.ts`

Verantwortung: `ExtractionResult` + `aufschlag` → `.xlsx` Blob.

Vorgeschlagene API:

- `buildExcel(result: ExtractionResult, opts: { aufschlag: number }): Promise<Blob>`

**Vorlagen-Look:** Die Excel wird nicht über das Mitliefern/Lesen der originalen Vorlage erzeugt, sondern über eine **kodierte** Workbook-Definition:

- Sheet-Name
- Header-Reihe(n)
- Spaltenbreiten
- Zahlformate (z. B. Currency)
- Formeln:
  - Einzelpreis VK = Einzelpreis PDF × (1 + Aufschlag)
  - Gesamt = Menge × Einzelpreis VK

Hinweis: Die „2 extra Spalten“ sind die in der Vorlage vorhandenen Spalten (z. B. Aufschlag/VK) und werden im Export abgebildet.

#### `src/app/convert.ts` (oder `src/features/convert/`)

Orchestrierung:

1. `pdfText = extractPdfLines(file)`
2. `result = runExtraction(pdfText)`
3. `xlsx = buildExcel(result, { aufschlag })`
4. UI löst Download/Share aus

### PWA-Offline Layer

Anforderungen:

- Web App Manifest (Name, Icons, Start URL)
- Service Worker:
  - Cache-first für App-Shell (HTML/CSS/JS)
  - Cache für MuPDF Assets / WASM Dateien

UX:

- App funktioniert ohne Netzwerk nach erstem Laden.
- Optionaler Offline-Indikator.

## Plattform-Einschränkungen (Browser/iPad)

- Kein Zugriff auf lokale Dateipfade; Import nur über File Picker, Export über Download/Share.
- Keine Child-Processes / Sidecars (Tauri-Ansatz entfällt).
- iPad Memory/CPU: Text-Representation und Strategien müssen effizient bleiben (keine riesigen Debug-Dumps).

## Datenmodelle

### `LineItem`

Analog Python `extractor/models.py`:

- `position?: string`
- `articleNumber?: string`
- `description: string`
- `quantity?: number`
- `unit?: string`
- `unitPrice?: number`
- `lineTotal?: number`

### `ExtractionResult`

- `layoutId: string`
- `sourcePdf: string`
- `items: LineItem[]`

## Fehlerhandling & Diagnostik

Standardisierte Fehlercodes:

- `PDF_PARSE_FAILED`
- `LAYOUT_UNKNOWN`
- `EXTRACTION_FAILED`
- `EXCEL_BUILD_FAILED`


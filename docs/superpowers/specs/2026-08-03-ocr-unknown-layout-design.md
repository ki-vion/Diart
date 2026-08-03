# OCR für unbekannte Layouts (Stufe 1) — Browser-SPA

## Ziel

Unbekannte / gescannte PDFs (kein MuPDF-Text, kein bekanntes Lieferantenprofil) sollen in der bestehenden **Offline-fähigen PWA** verarbeitet werden können. Beispiel: `Vorlagen/FPF2026234 Diart Bau und Dämmstoffe GmbH.pdf` (econ floor Proforma — MuPDF liefert 0 Text, aktuell `unbekannt | 0` Items).

OCR ist **Stufe 1**: Tesseract.js liefert Wörter mit Bounding-Boxen; daraus wird `PdfStructured` gebaut; die **bestehende** Extraktionspipeline (`runExtraction`, Profile, Generic, Excel) bleibt der Consumer.

## Nicht-Ziele

- Kein Table-Structure-ML (Table Transformer, PaddleOCR PP-Structure, …).
- Kein eigener OCR-/Backend-Service und keine Cloud-Document-AI.
- Kein OCR-Lauf bei **bekannten** Profilen (Mahler, RK, Norit, IFB, Laier).
- Keine Bild-CV-Pipeline (Linien/Zellen aus Pixeln ohne OCR-Wörter).
- Kein Ersatz von MuPDF für Text-PDFs mit erkanntem Layout.
- Kein Anspruch auf iLovePDF-/Solid-Documents-Tabellenqualität.

## Ausgangslage

- PWA unter `desktop/`: Vue + Vite, MuPDF.js WASM → `PdfStructured` → `runExtraction` → ExcelJS.
- Contract: `PdfStructured` / `PdfWord` (`text`, `x`, `y`, `fontSize`) in `desktop/src/pdf/types.ts`.
- Profil-Erkennung über Text-Fingerprints; Unknown → Generic-Table-Extract.
- Explizites früheres Nicht-Ziel „Keine OCR“ in `2026-05-28-pwa-offline-mupdf-design.md` wird für den Unknown-Pfad durch dieses Spec ersetzt; Text-PDF-Pfad bleibt MuPDF-only.

## Soll-Flow

```
File
  → extractPdfStructured (MuPDF)
  → detectProfile(structured)
  → if profile !== generic:
        runExtraction(structured)          # unverändert
     else:
        ocrStructuredFromPdf(file)         # neu, lazy
        runExtraction(ocrStructured)       # gleicher Orchestrator
  → buildExcelBuffer / Preview
```

### Gate

- Trigger: **`detectProfile` → `generic`** („kein bekanntes Layout“), nicht „Text leer“.
- Bekannte Profile: nie OCR (Performance + Qualität).
- MVP: bei Unknown immer OCR-`PdfStructured` für die Extraktion nutzen (FPF hat sowieso keinen MuPDF-Text). Später optional: Score/Item-Vergleich MuPDF vs. OCR, wenn MuPDF bei Unknown noch Text hat — **nicht** im MVP.

### Begründung Gate

Unknown ist der Produkt-Trigger („dieses Layout kennen wir nicht“). Empty-Text allein würde Scans mit Minimal-Müll-Text verfehlen und ist enger als gewünscht. OCR auf bekannten Layouts würde stabile Extrakte verschlechtern.

## Module & Verantwortlichkeiten

### `desktop/src/pdf/ocr/` (neu)

Verantwortung: PDF-Seiten rendern → OCR → `PdfStructured`.

Vorgeschlagene API:

- `ocrStructuredFromPdf(file: File): Promise<PdfStructured>`

Intern (Vorschlag, Implementierungsplan darf zerlegen):

1. Seiten als Bitmap rendern (MuPDF draw/pixmap oder gleichwertig; Explore-Tooling rendert bereits Previews).
2. Tesseract.js im **Web Worker**, Sprachen `deu` + `eng` (FPF ist EN/PL-Firmenkopf + DE Adressen; Zahlen/Tabellenlayout englisch beschriftet).
3. Wort-Ergebnisse → `PdfWord` (Box-Ursprung auf dieselbe Koordinatenkonvention wie MuPDF-Wörter mappen: Seite origin, y-Richtung konsistent zu bestehendem Clustering).
4. Zeilenbildung: bestehende Logik wiederverwenden oder dünner Adapter zu `structured-lines`-Äquivalent — Ziel ist gültiges `PdfPageStructured` (`lines`, `rawText`, `width`, `height`).

Lazy-Load: Tesseract + Sprachdaten erst beim ersten Unknown-Fall laden; PWA-Cache für Assets (Analog MuPDF-WASM; Größe der `traineddata` beachten).

### `desktop/src/lib/convert.web.ts`

Verantwortung: Gate einbauen — nach MuPDF + `detectProfile` bei `generic` OCR-Pfad wählen, sonst unverändert.

UI: während OCR Fortschritt/Hinweis („OCR läuft…“), weil deutlich langsamer als MuPDF.

### `desktop/src/extractor/` (unverändert am Contract)

- Weiterhin `runExtraction(structured: PdfStructured)`.
- Neues Profil für FPF / econ floor **nach** stabilem OCR-Output (kann Follow-up sein): Fingerprint z. B. „Proforma Invoice“, „econ floor“, „ECONFLOOR“, Spalten No. / Item / BOX / Quantity / Preise.
- MVP-Akzeptanz: OCR + Generic liefert brauchbare Zeilen **oder** OCR-Text ist reichhaltig genug, dass ein FPF-Profil in einem eng gekoppelten Follow-up greift. Spec-Priorität: zuerst OCR→`PdfStructured` end-to-end; FPF-Profil sobald Spalten mit Generic nicht zuverlässig sitzen.

### Excel / Preview

Unverändert; Input bleibt `ExtractionResult`.

## Datenfluss (Unknown)

```
PDF File
  → page bitmaps
  → Tesseract words { text, bbox }
  → PdfStructured (pages[].words/lines/rawText)
  → detectProfile (erneut auf OCR-Text; kann weiterhin generic sein)
  → extractByProfile / generic table
  → LineItem[] → xlsx
```

Hinweis: Nach OCR darf `detectProfile` erneut laufen (OCR-Text kann Fingerprints treffen). Wenn ein neues FPF-Profil existiert und matched, wird der profilspezifische Extractor genutzt; sonst Generic.

## Qualität & Erwartungen

- Zielmetrik: Positionen (Artikel, Menge, Einheit soweit erkennbar, Einzel-/Gesamtpreis) in der **Materialliste**-Excel, nicht pixelgleiche generische Tabellen-XLSX à la iLovePDF.
- FPF-Vorlage: scharfer Digitaldruck-Scan → gute Voraussetzungen für Tesseract-Zeichenerkennung; Spaltenzuordnung bleibt Heuristik-Aufgabe.
- Zahlenformate: europäische Beträge mit Leerzeichen-Tausender und Komma-Dezimal (`2 225,27`) müssen in Parser/Number-Utils landen (bestehende `parseDeNumber`-Pfade prüfen/erweitern falls nötig).

## Risiken & Mitigation

| Risiko | Mitigation |
|--------|------------|
| iPad Speicher/CPU | Worker; moderate Render-DPI; eine Seite nach der anderen; Sprachdaten cachen |
| Bundle/Cache-Größe | Lazy-Load; nur `deu`+`eng`; PWA `maximumFileSizeToCacheInBytes` ggf. anpassen |
| Koordinaten ≠ MuPDF | Explizite Normierung + Explore-Dump für OCR-Wörter analog `explore:mupdf` |
| OCR auf Unknown-Text-PDFs schlechter als MuPDF | Follow-up: Dual-Run + besserer Extrakt; MVP bewusst OCR-first bei Unknown |
| AGPL MuPDF bleibt | Unverändert; Tesseract.js Apache-2.0 — Lizenzmix dokumentieren |

## Tests / Verifikation

- Smoke: `FPF2026234…pdf` → `items.length > 0` (nach OCR-Pfad; Profil-ID `unbekannt` oder später `econ_floor` / ähnlich).
- Regression: bekannte Vorlagen-PDFs unverändert ohne OCR (Profil ≠ generic).
- Unit: Mapping OCR-BBox → `PdfWord` / Zeilenclustering an synthetischen Boxen.
- Manuell: Preview-Mengen/Preise gegen FPF-Seite 1 spot-checken.

## Umsetzungsschritte (Übersicht)

1. OCR-Modul + Worker + `PdfStructured`-Adapter.
2. Gate in `convert.web.ts` + UI-Hinweis.
3. Smoke/Explore für OCR-Output.
4. FPF-Profil nachziehen, falls Generic unzureichend.
5. README: Unknown-Layouts / Scan-Hinweis; Nicht-Ziel „keine OCR“ relativieren.

## Escapes (explizit später)

- Dual-Run MuPDF vs. OCR bei Unknown mit Text.
- Table-Transformer / Cloud-OCR nur wenn Stufe 1 an vielen Layouts scheitert.
- Dedizierter OCR-Service nur bei iPad-/Performance-Problemen.

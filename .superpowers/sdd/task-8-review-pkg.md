# Review Task 8
BASE: 3238eb1cf1867b53bbf0c813d64bdf95f2e66e0e HEAD: 2b0cc4969bae14ca107c38a327ada6e7463dee7a
## Commits

## Stat
 README.md                            | 16 +++++------
 desktop/package.json                 |  1 +
 desktop/scripts/smoke-ocr-extract.ts | 51 ++++++++++++++++++++++++++++++++++++
 desktop/src/pdf/mupdf-loader.ts      | 20 +++++++++++---
 4 files changed, 77 insertions(+), 11 deletions(-)

## Diff
diff --git a/README.md b/README.md
index bde4284..b4d9650 100644
--- a/README.md
+++ b/README.md
@@ -1,11 +1,11 @@
 # Diart ÔÇö PDF-Angebot zu Excel
 
-Offline-f├ñhige **Progressive Web App (PWA)** zum Extrahieren von Artikelpositionen aus **Text-PDFs** (Angebote/Rechnungen) und Export als Excel im Format ÔÇ×Materialliste mit VK PreisÔÇ£ (inkl. Aufschlag und VK-Formeln).
+Offline-f├ñhige **Progressive Web App (PWA)** zum Extrahieren von Artikelpositionen aus **PDF-Angeboten/Rechnungen** (Text-PDFs und gescannte/unbekannte Layouts per OCR) und Export als Excel im Format ÔÇ×Materialliste mit VK PreisÔÇ£ (inkl. Aufschlag und VK-Formeln).
 
 L├ñuft im Browser auf **Windows-PC** und **iPad** ÔÇö ohne Server, ohne `.exe`.
 
 ## Schnellstart
 
 **Voraussetzungen:** [Node.js](https://nodejs.org/) 20+
 
 ```bash
@@ -32,23 +32,25 @@ Nach dem ersten Laden werden App-Shell, MuPDF-WASM und Assets per Service Worker
 2. **Teilen ÔåÆ Zum Home-Bildschirm** ÔÇö installiert die PWA.
 3. PDF ausw├ñhlen, konvertieren, Excel ├╝ber **Download** speichern (z.ÔÇ»B. in ÔÇ×DateienÔÇ£).
 
 ### Tests
 
 ```bash
 cd desktop
 npm run test:run
+npm run smoke:extract   # Text-PDFs in Vorlagen/ (MuPDF-Layer)
+npm run smoke:ocr       # OCR-Pfad auf FPF-Proforma (gescannt/unbekannt)
 ```
 
 ### Unterst├╝tzte Layouts
 
-`kan_ifb`, `norit_rechnung`, `rk_stark`, `laier_van`, `mahler_angebot`
+`kan_ifb`, `norit_rechnung`, `rk_stark`, `laier_van`, `mahler_angebot`, `econ floor` (Proforma/Rechnungen per OCR)
 
-Die App l├ñdt PDFs als **`PdfStructured`** (MuPDF `asText` + W├Ârter mit x/y), erkennt ein **Profil** (`detectProfile`) und extrahiert mit dem passenden Parser (Orchestrator unter `desktop/src/extractor/`). Unbekannte PDFs nutzen den generischen Fallback `unbekannt`.
+Die App l├ñdt PDFs als **`PdfStructured`** (MuPDF `asText` + W├Ârter mit x/y), erkennt ein **Profil** (`detectProfile`) und extrahiert mit dem passenden Parser (Orchestrator unter `desktop/src/extractor/`). Bekannte Text-PDFs nutzen den MuPDF-Textlayer; **unbekannte oder gescannte PDFs** (`generic`) werden gerendert und per **OCR** (Tesseract.js, `deu`+`eng`) in dieselbe Struktur ├╝berf├╝hrt, danach Profil + Extraktion wie gewohnt.
 
 ```bash
 cd desktop
 npm run smoke:extract   # Schnelltest aller PDFs in Vorlagen/
 ```
 
 ### MuPDF erkunden (Entwicklung)
 
@@ -87,23 +89,21 @@ cd desktop
 npm run smoke:extract
 ```
 
 ### Technik
 
 | Schritt | Modul |
 |--------|--------|
 | PDF ÔåÆ Textzeilen | [MuPDF.js](https://www.npmjs.com/package/mupdf) (WASM) |
+| Unbekanntes Layout ÔåÆ OCR | [Tesseract.js](https://www.npmjs.com/package/tesseract.js) (`deu`+`eng`, nur bei Profil `generic`) |
 | Layout + Positionen | TypeScript (`desktop/src/extractor/`) |
 | Excel-Export | ExcelJS (`desktop/src/export/`) |
 
-**Hinweis:** MuPDF.js steht unter **AGPL** ÔÇö f├╝r kommerzielle Nutzung ggf. Lizenz bei Artifex kl├ñren.
+**Lizenzen:** MuPDF.js steht unter **AGPL** ÔÇö f├╝r kommerzielle Nutzung ggf. Lizenz bei Artifex kl├ñren. Tesseract.js und die mitgelieferten Sprachdaten (`deu`, `eng`) unter **Apache-2.0**. Die App kombiniert beide Laufzeit-Bibliotheken clientseitig in der PWA.
 
 Beispiel-PDFs zum Testen liegen in `Vorlagen/`.
 
 ## Dokumentation
 
 - Spezifikation: `docs/superpowers/specs/2026-05-28-pwa-offline-mupdf-design.md`
 - Implementierungsplan: `docs/superpowers/plans/2026-05-28-pwa-offline-mupdf-implementation.md`
-
-
-npm run explore:mupdf
-npm run explore:blocks
\ No newline at end of file
+- OCR / unbekannte Layouts: `docs/superpowers/specs/2026-08-03-ocr-unknown-layout-design.md`
\ No newline at end of file
diff --git a/desktop/package.json b/desktop/package.json
index 674e29b..5602dc2 100644
--- a/desktop/package.json
+++ b/desktop/package.json
@@ -7,16 +7,17 @@
     "dev": "vite",
     "build": "vue-tsc --noEmit && vite build",
     "preview": "vite preview",
     "test": "vitest",
     "test:run": "vitest run",
     "explore:mupdf": "tsx scripts/explore-mupdf.ts",
     "explore:blocks": "tsx scripts/explore-blocks.ts",
     "smoke:extract": "tsx scripts/smoke-table-extract.ts",
+    "smoke:ocr": "tsx scripts/smoke-ocr-extract.ts",
     "postinstall": "node scripts/copy-tesseract-assets.mjs"
   },
   "dependencies": {
     "exceljs": "^3.4.0",
     "mupdf": "^1.27.0",
     "tesseract.js": "^5.1.1",
     "vue": "^3.5.13"
   },
diff --git a/desktop/scripts/smoke-ocr-extract.ts b/desktop/scripts/smoke-ocr-extract.ts
new file mode 100644
index 0000000..817eca3
--- /dev/null
+++ b/desktop/scripts/smoke-ocr-extract.ts
@@ -0,0 +1,51 @@
+/**
+ * Smoke test: OCR path ÔåÆ PdfStructured ÔåÆ profile extraction (FPF / econ floor).
+ */
+import fs from "node:fs";
+import path from "node:path";
+import { fileURLToPath } from "node:url";
+import { ocrStructuredFromPdfBytes } from "../src/pdf/ocr/ocr-structured.js";
+import { getOcrWorker } from "../src/pdf/ocr/tesseract-worker.js";
+import { runExtraction } from "../src/extractor/orchestrator.js";
+
+const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
+const repoRoot = path.resolve(scriptsDir, "../..");
+const vorlagen = path.join(repoRoot, "Vorlagen");
+const fpfName = "FPF2026234 Diart Bau und D├ñmmstoffe GmbH.pdf";
+const fpfPath = path.join(vorlagen, fpfName);
+
+async function smokeOcrPdf(pdfPath: string): Promise<void> {
+  const bytes = new Uint8Array(fs.readFileSync(pdfPath));
+  const name = path.basename(pdfPath);
+  const structured = await ocrStructuredFromPdfBytes(bytes, name);
+  const result = runExtraction(structured);
+  console.log(`${name} | ${result.layout_id} | ${result.items.length}`);
+
+  if (name === fpfName) {
+    if (result.layout_id !== "econ floor") {
+      throw new Error(`Expected profile "econ floor", got "${result.layout_id}"`);
+    }
+    if (result.items.length < 1) {
+      throw new Error(`Expected >= 1 item from FPF OCR extract, got ${result.items.length}`);
+    }
+    if (result.items.length < 5) {
+      console.warn(`WARN: FPF items=${result.items.length} (prefer >= 5)`);
+    }
+  }
+}
+
+async function main() {
+  if (!fs.existsSync(fpfPath)) {
+    throw new Error(`Missing FPF sample: ${fpfPath}`);
+  }
+
+  console.log("PDF | profile | items");
+  console.log("--- | ------- | -----");
+  await smokeOcrPdf(fpfPath);
+  await (await getOcrWorker()).terminate();
+}
+
+main().catch((err) => {
+  console.error(err);
+  process.exit(1);
+});


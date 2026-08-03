# OCR Unknown-Layout (Stufe 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When MuPDF profile detection returns `generic`, run in-browser Tesseract.js OCR, map word boxes to `PdfStructured`, and extract line items (FPF/econ-floor scans first) without a backend.

**Architecture:** Keep MuPDF as the fast path for known suppliers. On `detectProfile === "generic"`, render pages with MuPDF `toPixmap`, OCR with Tesseract.js (Worker, `deu`+`eng`), convert words→`PdfStructured`, then call the existing `runExtraction`. No table-structure ML; FPF gets a dedicated profile after OCR text exists.

**Tech Stack:** Vue 3 + Vite 6 + TypeScript, MuPDF.js, Tesseract.js, Vitest, existing extractor/Excel pipeline.

## Global Constraints

- Browser SPA / offline PWA only — no OCR server or cloud Document AI.
- OCR runs only when MuPDF `detectProfile` returns `generic` — never for known profiles.
- OCR output must be valid `PdfStructured` (`desktop/src/pdf/types.ts`) so `runExtraction` stays unchanged at the contract.
- Languages: `deu` + `eng`; lazy-load Tesseract + traineddata on first Unknown convert.
- No Table Transformer / structure ML in this plan.
- Target fixture: `Vorlagen/FPF2026234 Diart Bau und Dämmstoffe GmbH.pdf`.

---

## File Structure

**Create:**
- `desktop/src/pdf/ocr/types.ts` — OCR word/bbox types
- `desktop/src/pdf/ocr/lines-from-words.ts` — cluster OCR words → `PdfLine[]`
- `desktop/src/pdf/ocr/lines-from-words.test.ts`
- `desktop/src/pdf/ocr/render-pages.ts` — MuPDF page → PNG bytes + scale metadata
- `desktop/src/pdf/ocr/tesseract-worker.ts` — lazy `createWorker`, recognize one image
- `desktop/src/pdf/ocr/ocr-structured.ts` — `ocrStructuredFromPdf(file)`
- `desktop/src/extractor/profiles/extract-econ-floor.ts` — FPF profile extract
- `desktop/src/extractor/table/econ-floor-extract.ts` — row parsing for Proforma table
- `desktop/src/extractor/table/econ-floor-extract.test.ts`
- `desktop/public/tesseract/` — worker/core/lang assets OR Vite-copied equivalents (see Task 1)
- `desktop/scripts/smoke-ocr-extract.ts` — Node smoke for OCR path on FPF

**Modify:**
- `desktop/package.json` — add `tesseract.js`; scripts for smoke OCR
- `desktop/vite.config.ts` — cache `traineddata` / tesseract assets; raise cache size if needed
- `desktop/src/lib/convert.web.ts` — Unknown gate + status callback
- `desktop/src/App.vue` — show OCR status while loading
- `desktop/src/extractor/profiles/types.ts` — add `"econ floor"` (or `"Econ Floor"`) profile id
- `desktop/src/extractor/profiles/detect-profile.ts` — fingerprints
- `desktop/src/extractor/profiles/index.ts` — switch case
- `desktop/src/extractor/utils.test.ts` — space-thousands number case
- `README.md` — Unknown/OCR note; drop absolute „keine OCR“

**Unchanged contract:**
- `desktop/src/pdf/types.ts` — `PdfStructured` / `PdfWord`
- `desktop/src/extractor/orchestrator.ts` — still `runExtraction(structured)`

---

### Task 1: Add Tesseract.js and Vite/PWA asset wiring

**Files:**
- Modify: `desktop/package.json`
- Modify: `desktop/vite.config.ts`
- Create: `desktop/scripts/copy-tesseract-assets.mjs` (or inline postinstall — pick one and keep it)

**Interfaces:**
- Consumes: none
- Produces: dependency `tesseract.js`; static assets under `desktop/public/tesseract/` served at `/tesseract/…` for offline Worker + `deu`/`eng` traineddata

- [ ] **Step 1: Install dependency**

Run from `desktop/`:

```bash
npm install tesseract.js@5
```

Expected: `tesseract.js` listed under `dependencies` in `package.json`.

- [ ] **Step 2: Vendor worker/lang files for offline use**

Create `desktop/scripts/copy-tesseract-assets.mjs` that copies from `node_modules/tesseract.js` / `tesseract.js-core` into `desktop/public/tesseract/`:

- `worker.min.js` (or current package worker path)
- WASM/JS core files required by tesseract.js v5
- `eng.traineddata` and `deu.traineddata` (download once from the tessdata CDN used by tesseract.js if not shipped in the package; commit or fetch in this script — prefer script fetch into `public/tesseract/` and gitignore huge files **only if** the team already gitignores binaries; otherwise commit traineddata for true offline clone). For Diart offline PWA: **commit** `eng.traineddata` + `deu.traineddata` under `public/tesseract/` so `npm run build` caches them.

Add npm script:

```json
"postinstall": "node scripts/copy-tesseract-assets.mjs"
```

Run:

```bash
node scripts/copy-tesseract-assets.mjs
```

Expected: `desktop/public/tesseract/` contains worker, core, `eng.traineddata`, `deu.traineddata`.

- [ ] **Step 3: Extend PWA cache for traineddata**

In `desktop/vite.config.ts`, update `workbox.globPatterns` to include traineddata and raise size limit:

```ts
workbox: {
  globPatterns: [
    "**/*.{js,css,html,wasm,png,svg,ico,webmanifest,traineddata}",
  ],
  maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
},
```

- [ ] **Step 4: Commit**

```bash
git add desktop/package.json desktop/package-lock.json desktop/vite.config.ts desktop/scripts/copy-tesseract-assets.mjs desktop/public/tesseract
git commit -m "$(cat <<'EOF'
chore: vendor tesseract.js assets for offline OCR

EOF
)"
```

---

### Task 2: Pure mapper — OCR words → `PdfLine[]`

**Files:**
- Create: `desktop/src/pdf/ocr/types.ts`
- Create: `desktop/src/pdf/ocr/lines-from-words.ts`
- Test: `desktop/src/pdf/ocr/lines-from-words.test.ts`

**Interfaces:**
- Consumes: `PdfLine`, `PdfWord` from `desktop/src/pdf/types.ts`
- Produces:
  - `export type OcrWordBox = { text: string; x0: number; y0: number; x1: number; y1: number }` (pixel space)
  - `export type PageRenderMeta = { pageIndex: number; widthPt: number; heightPt: number; scale: number }`
  - `export function pdfWordsFromOcrBoxes(words: OcrWordBox[], meta: PageRenderMeta): PdfWord[]`
  - `export function linesFromPdfWords(words: PdfWord[], yTol?: number): PdfLine[]`

Coordinate rule (must match MuPDF page space used elsewhere):

- Pixmap created with `Matrix.scale(scale, scale)` where `scale = dpi/72` (plan default **dpi = 144** → `scale = 2`).
- `x_pt = x0 / scale`, `y_pt = y0 / scale` (Tesseract and MuPDF pixmap share top-left origin for rendered bitmaps).
- `fontSize = max(6, (y1 - y0) / scale)`.

Line cluster: sort by `y`, then assign to same line if `|y - lineY| <= yTol` (default `3`), then sort words in line by `x`; `text = words.map(w => w.text).join(" ")`.

- [ ] **Step 1: Write the failing test**

Create `desktop/src/pdf/ocr/lines-from-words.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { linesFromPdfWords, pdfWordsFromOcrBoxes } from "./lines-from-words";

describe("pdfWordsFromOcrBoxes", () => {
  it("maps pixel boxes into PDF points using scale", () => {
    const words = pdfWordsFromOcrBoxes(
      [{ text: "Hello", x0: 100, y0: 40, x1: 180, y1: 60 }],
      { pageIndex: 0, widthPt: 595, heightPt: 842, scale: 2 },
    );
    expect(words).toHaveLength(1);
    expect(words[0]!.text).toBe("Hello");
    expect(words[0]!.x).toBeCloseTo(50);
    expect(words[0]!.y).toBeCloseTo(20);
    expect(words[0]!.fontSize).toBeCloseTo(10);
  });
});

describe("linesFromPdfWords", () => {
  it("clusters words with similar y into one line left-to-right", () => {
    const lines = linesFromPdfWords([
      { text: "B", x: 80, y: 100.5, fontSize: 10 },
      { text: "A", x: 10, y: 100, fontSize: 10 },
      { text: "C", x: 10, y: 140, fontSize: 10 },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]!.text).toBe("A B");
    expect(lines[1]!.text).toBe("C");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd desktop
npm run test:run -- src/pdf/ocr/lines-from-words.test.ts
```

Expected: FAIL (module / exports missing).

- [ ] **Step 3: Write minimal implementation**

`desktop/src/pdf/ocr/types.ts`:

```ts
export type OcrWordBox = {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type PageRenderMeta = {
  pageIndex: number;
  widthPt: number;
  heightPt: number;
  scale: number;
};
```

`desktop/src/pdf/ocr/lines-from-words.ts`: implement `pdfWordsFromOcrBoxes` and `linesFromPdfWords` per Interfaces above. Skip empty/whitespace `text`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd desktop
npm run test:run -- src/pdf/ocr/lines-from-words.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pdf/ocr/types.ts desktop/src/pdf/ocr/lines-from-words.ts desktop/src/pdf/ocr/lines-from-words.test.ts
git commit -m "$(cat <<'EOF'
feat: map OCR word boxes into PdfLine clusters

EOF
)"
```

---

### Task 3: Render PDF pages to PNG via MuPDF

**Files:**
- Create: `desktop/src/pdf/ocr/render-pages.ts`
- Test: `desktop/src/pdf/ocr/render-pages.test.ts` (optional light mock — prefer smoke in Task 8; here add a tiny unit that documents the public type if mocking MuPDF is heavy)

**Interfaces:**
- Consumes: `getMupdf()` from `desktop/src/pdf/mupdf-loader.ts`; `PageRenderMeta`
- Produces:
  - `export type RenderedPage = { png: Uint8Array; meta: PageRenderMeta }`
  - `export async function renderPdfPages(file: File, dpi?: number): Promise<RenderedPage[]>`
  - Default `dpi = 144`

Implementation sketch:

```ts
import { getMupdf } from "../mupdf-loader";
import type { PageRenderMeta } from "./types";

export type RenderedPage = { png: Uint8Array; meta: PageRenderMeta };

export async function renderPdfPages(
  file: File,
  dpi = 144,
): Promise<RenderedPage[]> {
  const mupdf = await getMupdf();
  const scale = dpi / 72;
  const buf = await file.arrayBuffer();
  const doc = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf");
  try {
    const out: RenderedPage[] = [];
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i);
      try {
        const bounds = page.getBounds();
        const widthPt = bounds[2] - bounds[0];
        const heightPt = bounds[3] - bounds[1];
        const pixmap = page.toPixmap(
          mupdf.Matrix.scale(scale, scale),
          mupdf.ColorSpace.DeviceRGB,
          false,
          true,
        );
        try {
          const png = pixmap.asPNG();
          out.push({
            png: png instanceof Uint8Array ? png : new Uint8Array(png),
            meta: { pageIndex: i, widthPt, heightPt, scale },
          });
        } finally {
          pixmap.destroy();
        }
      } finally {
        page.destroy();
      }
    }
    return out;
  } finally {
    doc.destroy();
  }
}
```

- [ ] **Step 1: Implement `render-pages.ts` as above**

- [ ] **Step 2: Quick Node sanity (optional but recommended)**

From `desktop/` using existing `loadMupdf` pattern, or defer full check to Task 8. If easy: small `tsx` one-liner that renders FPF page 0 and asserts `png.byteLength > 1000`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pdf/ocr/render-pages.ts
git commit -m "$(cat <<'EOF'
feat: render PDF pages to PNG for OCR

EOF
)"
```

---

### Task 4: Tesseract worker + `ocrStructuredFromPdf`

**Files:**
- Create: `desktop/src/pdf/ocr/tesseract-worker.ts`
- Create: `desktop/src/pdf/ocr/ocr-structured.ts`
- Create: `desktop/src/pdf/ocr/index.ts` (re-export `ocrStructuredFromPdf`)

**Interfaces:**
- Consumes: `renderPdfPages`, `pdfWordsFromOcrBoxes`, `linesFromPdfWords`, `OcrWordBox`
- Produces:
  - `export async function ocrStructuredFromPdf(file: File): Promise<PdfStructured>`
  - Worker paths use `/tesseract/…` (public folder)
  - `recognizePng(png: Uint8Array): Promise<OcrWordBox[]>` (internal or exported for tests)

Tesseract setup (v5):

```ts
import { createWorker } from "tesseract.js";

let workerPromise: Promise<Tesseract.Worker> | null = null;

export async function getOcrWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("deu+eng", 1, {
        workerPath: "/tesseract/worker.min.js",
        corePath: "/tesseract/",
        langPath: "/tesseract",
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function recognizePng(png: Uint8Array): Promise<OcrWordBox[]> {
  const worker = await getOcrWorker();
  const blob = new Blob([png], { type: "image/png" });
  const result = await worker.recognize(blob);
  return (result.data.words ?? [])
    .filter((w) => w.text?.trim())
    .map((w) => ({
      text: w.text.trim(),
      x0: w.bbox.x0,
      y0: w.bbox.y0,
      x1: w.bbox.x1,
      y1: w.bbox.y1,
    }));
}
```

Adjust `workerPath` / `corePath` filenames to whatever `copy-tesseract-assets.mjs` actually wrote (read the tesseract.js v5 docs/files on disk; do not invent paths).

`ocrStructuredFromPdf`:

```ts
export async function ocrStructuredFromPdf(file: File): Promise<PdfStructured> {
  const pagesRendered = await renderPdfPages(file, 144);
  const pages = [];
  for (const { png, meta } of pagesRendered) {
    const boxes = await recognizePng(png);
    const words = pdfWordsFromOcrBoxes(boxes, meta);
    const lines = linesFromPdfWords(words);
    const rawText = lines.map((l) => l.text).join("\n");
    pages.push({
      index: meta.pageIndex,
      width: meta.widthPt,
      height: meta.heightPt,
      lines,
      rawText,
    });
  }
  return { sourceFileName: file.name, pages };
}
```

Process **one page at a time** (already sequential) to limit iPad memory; destroy/ignore large intermediates.

- [ ] **Step 1: Implement worker + `ocrStructuredFromPdf`**

- [ ] **Step 2: Manual browser check in `npm run dev`**

Open app, temporarily call `ocrStructuredFromPdf` from console or a tiny debug button — or wait for Task 5 gate. Minimum: `rawText` for FPF contains `Proforma` or `ECONFLOOR` or `257255`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pdf/ocr/tesseract-worker.ts desktop/src/pdf/ocr/ocr-structured.ts desktop/src/pdf/ocr/index.ts
git commit -m "$(cat <<'EOF'
feat: OCR PDF pages into PdfStructured via Tesseract

EOF
)"
```

---

### Task 5: Unknown gate in `convert.web.ts` + UI status

**Files:**
- Modify: `desktop/src/lib/convert.web.ts`
- Modify: `desktop/src/App.vue`
- Test: `desktop/src/lib/convert.web.test.ts` (mock extract/ocr — keep small)

**Interfaces:**
- Consumes: `extractPdfStructured`, `detectProfile`, `ocrStructuredFromPdf`, `runExtraction`
- Produces: updated `convertPdfFile(file, aufschlagPercent, options?: { onStatus?: (msg: string) => void })`

Gate logic (replace the middle of `convertPdfFile`):

```ts
onStatus?.("PDF wird gelesen…");
const structured = await extractPdfStructured(file);
const { detectProfile, runExtraction } = await import("../extractor");
let forExtract = structured;
if (detectProfile(structured) === "generic") {
  onStatus?.("Unbekanntes Layout — OCR läuft…");
  const { ocrStructuredFromPdf } = await import("../pdf/ocr");
  forExtract = await ocrStructuredFromPdf(file);
}
onStatus?.("Positionen werden extrahiert…");
const extraction = runExtraction(forExtract);
const profile = detectProfile(forExtract);
const extraction_mode = profile === "generic" ? "table" : "layout";
```

Lazy-import OCR only inside the `generic` branch.

`App.vue`:

```ts
const status = ref("");
// in onPdfSelected:
status.value = "Wird konvertiert…";
const res = await convertPdfFile(file, aufschlagPercent.value, {
  onStatus: (msg) => {
    status.value = msg;
  },
});
// template: show status when loading
```

Button label can use `status || "Wird konvertiert…"`.

- [ ] **Step 1: Write a unit test with mocks**

`convert.web.test.ts` should assert: when `detectProfile` would be generic, OCR module is imported/called; when profile is Mahler, OCR is not called. Use `vi.mock` on `../pdf/structured`, `../pdf/ocr`, `../extractor`, `../export/excel`.

- [ ] **Step 2: Run test — expect fail, then implement gate + UI, then pass**

```bash
cd desktop
npm run test:run -- src/lib/convert.web.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add desktop/src/lib/convert.web.ts desktop/src/lib/convert.web.test.ts desktop/src/App.vue
git commit -m "$(cat <<'EOF'
feat: run OCR when layout profile is generic

EOF
)"
```

---

### Task 6: `parseDeNumber` space-thousands coverage

**Files:**
- Modify: `desktop/src/extractor/utils.test.ts`
- Modify: `desktop/src/extractor/utils.ts` only if a test fails

**Interfaces:**
- Consumes/Produces: existing `parseDeNumber(s: string): number | null`

Note: implementation already strips whitespace (`replace(/\s+/g, "")`). This task only locks FPF-style amounts.

- [ ] **Step 1: Add failing-or-passing test**

```ts
it("parses space as thousands separator", () => {
  expect(parseDeNumber("2 225,27")).toBeCloseTo(2225.27);
});
```

- [ ] **Step 2: Run**

```bash
cd desktop
npm run test:run -- src/extractor/utils.test.ts
```

Expected: PASS with current impl; if FAIL, fix `utils.ts` minimally.

- [ ] **Step 3: Commit**

```bash
git add desktop/src/extractor/utils.test.ts desktop/src/extractor/utils.ts
git commit -m "$(cat <<'EOF'
test: cover parseDeNumber with space thousands

EOF
)"
```

---

### Task 7: Econ Floor / FPF profile

Generic English headers (`No.`, `Quantity UOM`, …) often miss German generic heuristics — add a dedicated profile once OCR `rawText` contains supplier fingerprints.

**Files:**
- Modify: `desktop/src/extractor/profiles/types.ts`
- Modify: `desktop/src/extractor/profiles/detect-profile.ts`
- Modify: `desktop/src/extractor/profiles/detect-profile.test.ts`
- Modify: `desktop/src/extractor/profiles/index.ts`
- Create: `desktop/src/extractor/table/econ-floor-extract.ts`
- Create: `desktop/src/extractor/table/econ-floor-extract.test.ts`
- Create: `desktop/src/extractor/profiles/extract-econ-floor.ts`

**Interfaces:**
- Profile id: `"econ floor"` (lowercase brand-style like fingerprints; `layout_id` same string)
- `detectProfile`: return `"econ floor"` when page0 matches any of:
  - `/Proforma Invoice/i`
  - `/ECONFLOOR/i`
  - `/econ floor/i`
  - `/FPF\/\d{4}\/\d+/i`
- `extractEconFloorItems(structured: PdfStructured): { items: LineItem[] }`
- Wire in `extractByProfile` case `"econ floor"`.

Extraction approach (geometry, same spirit as Mahler):

1. Find header line containing `No.` and `Item` / `Quantity` (OCR may garble — prefer `/No\.?/i` + `/Quantity/i` or `/Item/i`).
2. Position anchors: lines whose first cell / leftmost word matches `/^\d{1,3}$/` and sits near the No. column (after header, before totals / `Total to be Paid` / `Payment Form`).
3. Per block until next position: article code (`/^\d{5,8}$/`), description words, BOX integer, qty+unit (`27,72` + `m2` / `m²` / `pcs` / `pc`), unit price, line total (ignore `0%` VAT column).
4. Use column x-windows calibrated from an OCR dump of the FPF fixture (run explore/OCR dump during implementation; hard-code `defaultWindows` in the extract module like `pipeline/templates.ts`).

Unit test with **synthetic** `PdfStructured` (no Tesseract in unit tests): 2 fake items with words at plausible x/y.

- [ ] **Step 1: Write detect-profile + synthetic extract failing tests**

- [ ] **Step 2: Implement detect + extract + wire `index.ts`**

- [ ] **Step 3: Run**

```bash
cd desktop
npm run test:run -- src/extractor/profiles/detect-profile.test.ts src/extractor/table/econ-floor-extract.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add desktop/src/extractor/profiles desktop/src/extractor/table/econ-floor-extract.ts desktop/src/extractor/table/econ-floor-extract.test.ts
git commit -m "$(cat <<'EOF'
feat: add econ floor profile for OCR proforma invoices

EOF
)"
```

---

### Task 8: Smoke OCR path + README

**Files:**
- Create: `desktop/scripts/smoke-ocr-extract.ts`
- Modify: `desktop/package.json` (`"smoke:ocr": "tsx scripts/smoke-ocr-extract.ts"`)
- Modify: `README.md`
- Optional: extend `explore:mupdf` or add `explore:ocr` dumping `page-XX-ocr-words.tsv` — only if needed to calibrate Task 7 windows; if calibration already done, skip.

**Interfaces:**
- Smoke script for Node: load PDF as `File`-like or adapt `ocrStructuredFromPdf` to also accept `Uint8Array` + filename.

If `File` is awkward in Node, add:

```ts
export async function ocrStructuredFromPdfBytes(
  bytes: Uint8Array,
  sourceFileName: string,
): Promise<PdfStructured>
```

and have `ocrStructuredFromPdf(file)` call it.

Smoke expectations:

```
FPF2026234 Diart Bau und Dämmstoffe GmbH.pdf | econ floor | >= 1
```

Also print item count for one known text PDF **without** claiming OCR ran (optional: assert Mahler path still works via existing `smoke:extract`).

README updates:

- Unterstützte Layouts: add econ floor / OCR-Hinweis.
- Technik-Tabelle: OCR-Zeile (Tesseract.js, nur Unknown).
- Remove or qualify any „nur Text-PDFs / keine OCR“ wording.
- Mention AGPL MuPDF + Apache-2.0 Tesseract license mix briefly.

- [ ] **Step 1: Implement `ocrStructuredFromPdfBytes` + smoke script**

- [ ] **Step 2: Run**

```bash
cd desktop
npm run smoke:ocr
```

Expected: FPF line shows profile `econ floor` (or still `unbekannt` only if extract falls back) and `items >= 1`. Prefer `items >= 5` (table has 6 rows including Transport).

- [ ] **Step 3: Regression**

```bash
cd desktop
npm run smoke:extract
npm run test:run
```

Expected: known Vorlagen still extract with previous item counts (Mahler/RK/…); unit tests green.

- [ ] **Step 4: Update README + commit**

```bash
git add desktop/scripts/smoke-ocr-extract.ts desktop/package.json desktop/src/pdf/ocr README.md
git commit -m "$(cat <<'EOF'
feat: smoke OCR extraction and document unknown-layout path

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Unknown/`generic` → OCR | Task 5 |
| Known profiles skip OCR | Task 5 test |
| `ocrStructuredFromPdf` → `PdfStructured` | Tasks 2–4 |
| Tesseract Worker + `deu`/`eng` + lazy | Tasks 1, 4 |
| PWA cache traineddata | Task 1 |
| UI OCR status | Task 5 |
| FPF / econ floor profile | Task 7 |
| Space thousands amounts | Task 6 |
| Smoke FPF items > 0 | Task 8 |
| README / no absolute „keine OCR“ | Task 8 |
| No structure-ML / no server | Global Constraints |
| Dual-run MuPDF vs OCR | Out of scope (spec escape) |

---

## Execution notes

- Prefer **subagent-driven-development** per task; do not skip TDD steps on pure functions (Tasks 2, 6, 7).
- If Task 7 calibration needs real OCR boxes, run a one-off dump before hard-coding windows — do not block Task 4/5 on perfect FPF extract.
- iPad: keep dpi at 144 unless OCR quality fails; then try 200 before raising further.

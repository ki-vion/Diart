### Task 4: Tesseract worker + `ocrStructuredFromPdf`

**Files:**
- Create: `desktop/src/pdf/ocr/tesseract-worker.ts`
- Create: `desktop/src/pdf/ocr/ocr-structured.ts`
- Create: `desktop/src/pdf/ocr/index.ts` (re-export `ocrStructuredFromPdf`)

**Interfaces:**
- Consumes: `renderPdfPages`, `pdfWordsFromOcrBoxes`, `linesFromPdfWords`, `OcrWordBox`
- Produces:
  - `export async function ocrStructuredFromPdf(file: File): Promise<PdfStructured>`
  - Worker paths use `/tesseract/â€¦` (public folder)
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

Open app, temporarily call `ocrStructuredFromPdf` from console or a tiny debug button â€” or wait for Task 5 gate. Minimum: `rawText` for FPF contains `Proforma` or `ECONFLOOR` or `257255`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pdf/ocr/tesseract-worker.ts desktop/src/pdf/ocr/ocr-structured.ts desktop/src/pdf/ocr/index.ts
git commit -m "$(cat <<'EOF'
feat: OCR PDF pages into PdfStructured via Tesseract

EOF
)"
```

---

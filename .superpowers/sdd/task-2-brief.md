### Task 2: Pure mapper â€” OCR words â†’ `PdfLine[]`

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

- Pixmap created with `Matrix.scale(scale, scale)` where `scale = dpi/72` (plan default **dpi = 144** â†’ `scale = 2`).
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

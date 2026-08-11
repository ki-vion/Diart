# Task 2 Report: Pure mapper — OCR words → PdfLine[]

## Status
DONE

## Summary
Added pure TypeScript OCR→PDF coordinate mapper under `desktop/src/pdf/ocr/`: `pdfWordsFromOcrBoxes` converts Tesseract pixel boxes to `PdfWord[]` using render scale, and `linesFromPdfWords` clusters words into `PdfLine[]` by y-tolerance (default 3pt) with left-to-right ordering.

## Changes
- `desktop/src/pdf/ocr/types.ts` — `OcrWordBox`, `PageRenderMeta`
- `desktop/src/pdf/ocr/lines-from-words.ts` — `pdfWordsFromOcrBoxes`, `linesFromPdfWords`
- `desktop/src/pdf/ocr/lines-from-words.test.ts` — coordinate mapping + line clustering tests

## TDD Evidence

### RED (Step 2)
```
npm run test:run -- src/pdf/ocr/lines-from-words.test.ts

 FAIL  src/pdf/ocr/lines-from-words.test.ts
Error: Failed to resolve import "./lines-from-words" from "src/pdf/ocr/lines-from-words.test.ts". Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
```

### GREEN (Step 4)
```
npm run test:run -- src/pdf/ocr/lines-from-words.test.ts

 Test Files  1 passed (1)
      Tests  2 passed (2)
```

## Commit
- `b74b47b` — feat: map OCR word boxes into PdfLine clusters

## Self-review
- Coordinate rule matches brief: `x/y = pixel / scale`, `fontSize = max(6, boxHeight / scale)`.
- Empty/whitespace OCR text skipped via `.trim()` filter.
- Line clustering mirrors existing `groupWordsIntoLines` in `table-words.ts` (same y-tolerance semantics, running average y).
- No Tesseract runtime dependency — pure mapper only.
- Types re-exported from `lines-from-words.ts` for convenient single import path.

## Concerns
- `linesFromPdfWords` duplicates logic in `groupWordsIntoLines`; could delegate later to DRY, but kept local per task scope.
- `PageRenderMeta.widthPt/heightPt/pageIndex` unused in mapper today — reserved for downstream page assembly (Task 3+).

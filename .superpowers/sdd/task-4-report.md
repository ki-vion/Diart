# Task 4 Report: Tesseract worker + ocrStructuredFromPdf

## Status
DONE

## Summary
Added singleton Tesseract worker (`deu+eng`, OEM LSTM), `recognizePng`, and `ocrStructuredFromPdf` / `ocrStructuredFromPdfBytes` wiring `renderPdfPages` (144 dpi) → OCR boxes → Task 2 mappers → `PdfStructured`. Browser uses `/tesseract/worker.min.js`, `corePath: /tesseract/`, local `langPath`, `gzip: false` for uncompressed traineddata.

## Changes
- `desktop/src/pdf/ocr/tesseract-worker.ts` — `getOcrWorker`, `recognizePng`
- `desktop/src/pdf/ocr/ocr-structured.ts` — `ocrStructuredFromPdf`, `ocrStructuredFromPdfBytes`
- `desktop/src/pdf/ocr/index.ts` — re-exports

## Verification
- `vue-tsc --noEmit` — pass
- `npx tsx scripts/smoke-ocr-fpf.ts` — **OK: found "Proforma"** in OCR rawText (2 pages); script uses Node MuPDF + same OCR/mapping modules (uncommitted helper)

## Commit
- `8e98342` — feat: OCR PDF pages into PdfStructured via Tesseract

## Concerns
- Full browser dev smoke not run here; Node path validates pipeline end-to-end
- All page PNGs held in memory via `renderPdfPages` before OCR; sequential OCR limits peak vs parallel
- Node OCR uses default tesseract.js worker; browser uses copied `worker.min.js` + wasm in `public/tesseract`


## Review fix (per-page memory)
- **Status:** DONE
- OCR path uses `forEachRenderedPdfPage`: render one page, OCR, discard PNG before next page.
- `renderPdfPages(file)` unchanged API; still accumulates all PNGs for callers that need it.
- Removed accidental `desktop/deu.traineddata` and `desktop/eng.traineddata` (canonical copies under `public/tesseract/`).
- **Verification:** `vue-tsc --noEmit` pass; `npx tsx scripts/smoke-ocr-fpf.ts` — OK: found "Proforma" (2 pages).
- **Commit:** 95e84ef


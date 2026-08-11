# Task 8 Report: Smoke OCR path + README

## Status: DONE

## Commits
- `feat: smoke OCR extraction and document unknown-layout path`

## smoke:ocr
```
FPF2026234 Diart Bau und Dämmstoffe GmbH.pdf | econ floor | 6
```
Profile `econ floor`, items **6** (>= 5). Exit ~20s after worker terminate.

## Regression
- `npm run smoke:extract` — all 12 Vorlagen PDFs unchanged (Mahler 26, RK/Norit/Laier/IFB counts as before; FPF `unbekannt | 0` on text layer — expected)
- `npm run test:run` — **37 files, 140 tests PASS**

## Changes
- `desktop/scripts/smoke-ocr-extract.ts` — FPF via `ocrStructuredFromPdfBytes` + `runExtraction`; terminates Tesseract worker
- `desktop/package.json` — `smoke:ocr` script
- `desktop/src/pdf/mupdf-loader.ts` — Node-safe wasm path (enables OCR smoke in tsx)
- `README.md` — econ floor, OCR for `generic`, license note (AGPL MuPDF + Apache-2.0 Tesseract), removed stray lines

## Concerns
- FPF column windows calibrated from one sample; other scans may drift
- `mupdf-loader` Node branch not covered by unit tests (smoke validates end-to-end)

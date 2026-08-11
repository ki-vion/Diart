# Task 3 Report: Render PDF pages to PNG via MuPDF

## Status
DONE

## Summary
Added `renderPdfPages(file, dpi?)` under `desktop/src/pdf/ocr/render-pages.ts`. Each page is rasterized via MuPDF `toPixmap(Matrix.scale(dpi/72), DeviceRGB)` → `asPNG()`, with `PageRenderMeta` (pageIndex, widthPt, heightPt, scale). Default dpi=144 (scale=2). Pixmap, page, and doc are destroyed in try/finally.

## Changes
- `desktop/src/pdf/ocr/render-pages.ts` — `RenderedPage`, `renderPdfPages`

## Verification
- `vue-tsc --noEmit` — pass
- Node sanity (loadMupdf, FPF page 0): **193161 bytes OK** (>1000)
- No unit test added — brief defers full smoke to Task 8; MuPDF mock is heavy

## Commit
- `a11167e` — feat: render PDF pages to PNG for OCR

## Self-review
- Matches brief sketch: `getMupdf()`, default dpi=144, scale=dpi/72, DeviceRGB, alpha=false, annots=true
- Resource cleanup: pixmap/page/doc all destroyed in nested finally blocks
- PNG normalized to `Uint8Array` when `asPNG()` returns ArrayBuffer-like
- Bounds from `page.getBounds()` feed `widthPt`/`heightPt` for downstream OCR coordinate mapping (Task 2)
- Browser-only via `getMupdf()` + `File`; Node sanity used parallel `loadMupdf` pattern

## Concerns
- Full in-browser render of multi-page scans not exercised until Task 4/8 integration
- Large PDFs allocate all page PNGs in memory at once — acceptable for Stufe 1 invoice scans, may need streaming later

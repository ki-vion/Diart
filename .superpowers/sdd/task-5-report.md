# Task 5 Report: Unknown gate in convert.web.ts + UI status

## Status
**Complete**

## Changes

### `desktop/src/lib/convert.web.ts`
- Added optional `options?: { onStatus?: (msg: string) => void }` to `convertPdfFile`.
- Gate: after `extractPdfStructured`, if `detectProfile(structured) === "generic"`, lazy-import `ocrStructuredFromPdf` and use OCR result for extraction.
- Status callbacks: "PDF wird gelesen…", "Unbekanntes Layout — OCR läuft…", "Positionen werden extrahiert…".
- `extraction_mode` derived from profile of `forExtract` (post-OCR when applicable).

### `desktop/src/App.vue`
- Added `status` ref; wired `onStatus` into `convertPdfFile`.
- Button label shows live status while loading: `status || "Wird konvertiert…"`.

### `desktop/src/lib/convert.web.test.ts` (new)
- Three unit tests with `vi.mock` on structured, ocr, extractor, excel:
  1. Generic profile → OCR called, extraction uses OCR output, mode `table`.
  2. Mahler profile → OCR not called, mode `layout`.
  3. `onStatus` receives all three German status strings.

## Tests
```
npm run test:run -- src/lib/convert.web.test.ts
→ 3 passed
```

## Browser smoke
- `npm run dev` started successfully (Vite on http://localhost:5173/).
- Full browser UI E2E deferred per brief; unit tests with mocks cover gate logic.

## Commit
```
feat: run OCR when layout profile is generic
```

## Concerns
- None blocking. OCR only loads dynamically for generic layouts; known profiles unchanged.

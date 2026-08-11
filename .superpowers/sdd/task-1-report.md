# Task 1 Report: Tesseract.js and Vite/PWA asset wiring

## Status
DONE

## Summary
Installed `tesseract.js@5` (resolved `^5.1.1`) in `desktop/`, added `scripts/copy-tesseract-assets.mjs` with `postinstall`, vendored worker/core/WASM and `eng`+`deu` traineddata under `desktop/public/tesseract/`, and extended Vite PWA Workbox patterns and cache size limit per plan.

## Changes
- `desktop/package.json` — dependency + postinstall script
- `desktop/package-lock.json` — lockfile update
- `desktop/scripts/copy-tesseract-assets.mjs` — copy/fetch script
- `desktop/public/tesseract/*` — 11 vendored files
- `desktop/vite.config.ts` — traineddata glob + 30MB cache limit

## Inspected package paths (tesseract.js v5.1.1)
- Worker: `node_modules/tesseract.js/dist/worker.min.js`
- Core (`tesseract.js-core`, per local-installation.md): four `*.wasm.js` plus matching `*.wasm` files
- Lang: CDN `@tesseract.js-data/{lang}/4.0.0/{lang}.traineddata.gz` gunzipped to `eng.traineddata` / `deu.traineddata`

## Verification
- `node scripts/copy-tesseract-assets.mjs` — OK
- `npm run build` — OK; PWA precache 28 entries (~78 MiB)

## Commit
- `ac5d4ba` — chore: vendor tesseract.js assets for offline OCR

## Self-review
Matches brief; core set per tesseract.js docs; traineddata committed for offline clone.

## Concerns
- Large binary footprint in git (~69MB under public/tesseract)
- Runtime workerPath/corePath/langPath wiring deferred to later tasks


## Review fix (PWA manifest name encoding)

**Finding:** PWA manifest `name` in `desktop/vite.config.ts` was corrupted to mojibake instead of a Unicode em dash.

**Fix:** Restored `name` to `Diart — PDF zu Excel` (U+2014 EM DASH). Workbox `globPatterns` (traineddata) and `maximumFileSizeToCacheInBytes` (30MB) unchanged.

**Verification:**
- Read `desktop/vite.config.ts` line 13: `name: "Diart — PDF zu Excel"`
- Confirmed separator is single character U+2014, not UTF-8 mojibake sequence

**Commit:** `5a9d053` — `fix: restore PWA manifest name encoding`

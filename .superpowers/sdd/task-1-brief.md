### Task 1: Add Tesseract.js and Vite/PWA asset wiring

**Files:**
- Modify: `desktop/package.json`
- Modify: `desktop/vite.config.ts`
- Create: `desktop/scripts/copy-tesseract-assets.mjs` (or inline postinstall â€” pick one and keep it)

**Interfaces:**
- Consumes: none
- Produces: dependency `tesseract.js`; static assets under `desktop/public/tesseract/` served at `/tesseract/â€¦` for offline Worker + `deu`/`eng` traineddata

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
- `eng.traineddata` and `deu.traineddata` (download once from the tessdata CDN used by tesseract.js if not shipped in the package; commit or fetch in this script â€” prefer script fetch into `public/tesseract/` and gitignore huge files **only if** the team already gitignores binaries; otherwise commit traineddata for true offline clone). For Diart offline PWA: **commit** `eng.traineddata` + `deu.traineddata` under `public/tesseract/` so `npm run build` caches them.

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

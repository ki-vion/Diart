### Task 5: Unknown gate in `convert.web.ts` + UI status

**Files:**
- Modify: `desktop/src/lib/convert.web.ts`
- Modify: `desktop/src/App.vue`
- Test: `desktop/src/lib/convert.web.test.ts` (mock extract/ocr â€” keep small)

**Interfaces:**
- Consumes: `extractPdfStructured`, `detectProfile`, `ocrStructuredFromPdf`, `runExtraction`
- Produces: updated `convertPdfFile(file, aufschlagPercent, options?: { onStatus?: (msg: string) => void })`

Gate logic (replace the middle of `convertPdfFile`):

```ts
onStatus?.("PDF wird gelesenâ€¦");
const structured = await extractPdfStructured(file);
const { detectProfile, runExtraction } = await import("../extractor");
let forExtract = structured;
if (detectProfile(structured) === "generic") {
  onStatus?.("Unbekanntes Layout â€” OCR lÃ¤uftâ€¦");
  const { ocrStructuredFromPdf } = await import("../pdf/ocr");
  forExtract = await ocrStructuredFromPdf(file);
}
onStatus?.("Positionen werden extrahiertâ€¦");
const extraction = runExtraction(forExtract);
const profile = detectProfile(forExtract);
const extraction_mode = profile === "generic" ? "table" : "layout";
```

Lazy-import OCR only inside the `generic` branch.

`App.vue`:

```ts
const status = ref("");
// in onPdfSelected:
status.value = "Wird konvertiertâ€¦";
const res = await convertPdfFile(file, aufschlagPercent.value, {
  onStatus: (msg) => {
    status.value = msg;
  },
});
// template: show status when loading
```

Button label can use `status || "Wird konvertiertâ€¦"`.

- [ ] **Step 1: Write a unit test with mocks**

`convert.web.test.ts` should assert: when `detectProfile` would be generic, OCR module is imported/called; when profile is Mahler, OCR is not called. Use `vi.mock` on `../pdf/structured`, `../pdf/ocr`, `../extractor`, `../export/excel`.

- [ ] **Step 2: Run test â€” expect fail, then implement gate + UI, then pass**

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

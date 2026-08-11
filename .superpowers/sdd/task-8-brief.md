### Task 8: Smoke OCR path + README

**Files:**
- Create: `desktop/scripts/smoke-ocr-extract.ts`
- Modify: `desktop/package.json` (`"smoke:ocr": "tsx scripts/smoke-ocr-extract.ts"`)
- Modify: `README.md`
- Optional: extend `explore:mupdf` or add `explore:ocr` dumping `page-XX-ocr-words.tsv` â€” only if needed to calibrate Task 7 windows; if calibration already done, skip.

**Interfaces:**
- Smoke script for Node: load PDF as `File`-like or adapt `ocrStructuredFromPdf` to also accept `Uint8Array` + filename.

If `File` is awkward in Node, add:

```ts
export async function ocrStructuredFromPdfBytes(
  bytes: Uint8Array,
  sourceFileName: string,
): Promise<PdfStructured>
```

and have `ocrStructuredFromPdf(file)` call it.

Smoke expectations:

```
FPF2026234 Diart Bau und DÃ¤mmstoffe GmbH.pdf | econ floor | >= 1
```

Also print item count for one known text PDF **without** claiming OCR ran (optional: assert Mahler path still works via existing `smoke:extract`).

README updates:

- UnterstÃ¼tzte Layouts: add econ floor / OCR-Hinweis.
- Technik-Tabelle: OCR-Zeile (Tesseract.js, nur Unknown).
- Remove or qualify any â€žnur Text-PDFs / keine OCRâ€œ wording.
- Mention AGPL MuPDF + Apache-2.0 Tesseract license mix briefly.

- [ ] **Step 1: Implement `ocrStructuredFromPdfBytes` + smoke script**

- [ ] **Step 2: Run**

```bash
cd desktop
npm run smoke:ocr
```

Expected: FPF line shows profile `econ floor` (or still `unbekannt` only if extract falls back) and `items >= 1`. Prefer `items >= 5` (table has 6 rows including Transport).

- [ ] **Step 3: Regression**

```bash
cd desktop
npm run smoke:extract
npm run test:run
```

Expected: known Vorlagen still extract with previous item counts (Mahler/RK/â€¦); unit tests green.

- [ ] **Step 4: Update README + commit**

```bash
git add desktop/scripts/smoke-ocr-extract.ts desktop/package.json desktop/src/pdf/ocr README.md
git commit -m "$(cat <<'EOF'
feat: smoke OCR extraction and document unknown-layout path

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Unknown/`generic` â†’ OCR | Task 5 |
| Known profiles skip OCR | Task 5 test |
| `ocrStructuredFromPdf` â†’ `PdfStructured` | Tasks 2â€“4 |
| Tesseract Worker + `deu`/`eng` + lazy | Tasks 1, 4 |
| PWA cache traineddata | Task 1 |
| UI OCR status | Task 5 |
| FPF / econ floor profile | Task 7 |
| Space thousands amounts | Task 6 |
| Smoke FPF items > 0 | Task 8 |
| README / no absolute â€žkeine OCRâ€œ | Task 8 |
| No structure-ML / no server | Global Constraints |
| Dual-run MuPDF vs OCR | Out of scope (spec escape) |

---

## Execution notes

- Prefer **subagent-driven-development** per task; do not skip TDD steps on pure functions (Tasks 2, 6, 7).
- If Task 7 calibration needs real OCR boxes, run a one-off dump before hard-coding windows â€” do not block Task 4/5 on perfect FPF extract.
- iPad: keep dpi at 144 unless OCR quality fails; then try 200 before raising further.

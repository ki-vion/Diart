### Task 7: Econ Floor / FPF profile

Generic English headers (`No.`, `Quantity UOM`, â€¦) often miss German generic heuristics â€” add a dedicated profile once OCR `rawText` contains supplier fingerprints.

**Files:**
- Modify: `desktop/src/extractor/profiles/types.ts`
- Modify: `desktop/src/extractor/profiles/detect-profile.ts`
- Modify: `desktop/src/extractor/profiles/detect-profile.test.ts`
- Modify: `desktop/src/extractor/profiles/index.ts`
- Create: `desktop/src/extractor/table/econ-floor-extract.ts`
- Create: `desktop/src/extractor/table/econ-floor-extract.test.ts`
- Create: `desktop/src/extractor/profiles/extract-econ-floor.ts`

**Interfaces:**
- Profile id: `"econ floor"` (lowercase brand-style like fingerprints; `layout_id` same string)
- `detectProfile`: return `"econ floor"` when page0 matches any of:
  - `/Proforma Invoice/i`
  - `/ECONFLOOR/i`
  - `/econ floor/i`
  - `/FPF\/\d{4}\/\d+/i`
- `extractEconFloorItems(structured: PdfStructured): { items: LineItem[] }`
- Wire in `extractByProfile` case `"econ floor"`.

Extraction approach (geometry, same spirit as Mahler):

1. Find header line containing `No.` and `Item` / `Quantity` (OCR may garble â€” prefer `/No\.?/i` + `/Quantity/i` or `/Item/i`).
2. Position anchors: lines whose first cell / leftmost word matches `/^\d{1,3}$/` and sits near the No. column (after header, before totals / `Total to be Paid` / `Payment Form`).
3. Per block until next position: article code (`/^\d{5,8}$/`), description words, BOX integer, qty+unit (`27,72` + `m2` / `mÂ²` / `pcs` / `pc`), unit price, line total (ignore `0%` VAT column).
4. Use column x-windows calibrated from an OCR dump of the FPF fixture (run explore/OCR dump during implementation; hard-code `defaultWindows` in the extract module like `pipeline/templates.ts`).

Unit test with **synthetic** `PdfStructured` (no Tesseract in unit tests): 2 fake items with words at plausible x/y.

- [ ] **Step 1: Write detect-profile + synthetic extract failing tests**

- [ ] **Step 2: Implement detect + extract + wire `index.ts`**

- [ ] **Step 3: Run**

```bash
cd desktop
npm run test:run -- src/extractor/profiles/detect-profile.test.ts src/extractor/table/econ-floor-extract.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add desktop/src/extractor/profiles desktop/src/extractor/table/econ-floor-extract.ts desktop/src/extractor/table/econ-floor-extract.test.ts
git commit -m "$(cat <<'EOF'
feat: add econ floor profile for OCR proforma invoices

EOF
)"
```

---

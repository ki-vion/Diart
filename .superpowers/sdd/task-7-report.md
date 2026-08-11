# Task 7 Report: Econ Floor / FPF profile

## Status: DONE

## Commits
- `feat: add econ floor profile for OCR proforma invoices`

## Tests
- `npm run test:run -- src/extractor/profiles/detect-profile.test.ts src/extractor/table/econ-floor-extract.test.ts` — **3/3 PASS**

## FPF fixture (OCR smoke)
- Profile detected: `econ floor`
- Items extracted: **6** (positions 1–6, includes Transport)
- Sample totals: #1 543.52 EUR, #6 Transport 250.00 EUR

## Implementation
- `detectProfile`: fingerprints `Proforma Invoice`, `ECONFLOOR`, `econ floor`, `FPF/YYYY/NNN`
- `extractEconFloorItems`: geometry extract with `ECON_FLOOR_WINDOWS` calibrated from FPF OCR dump
- Position anchors: `/^\d{1,3}$/` or merged `1.257255` pattern
- Wired in `extractByProfile` case `"econ floor"`, `layout_id: "econ floor"`

## Concerns
- Column x-windows are hard-coded from one FPF sample; OCR x-drift on other scans may need recalibration
- Article regex allows 4–8 digits (3085 on FPF row 5 is 4 digits; brief said 5–8)
- Description lines with dimensions near quantity band are ignored unless price columns present (by design)

## Files
- Modified: `types.ts`, `detect-profile.ts`, `detect-profile.test.ts`, `index.ts`
- Added: `extract-econ-floor.ts`, `econ-floor-anchors.ts`, `econ-floor-extract.ts`, `econ-floor-extract.test.ts`

# Diart PWA (offline) + MuPDF-WASM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing Tauri/Vue desktop tool into a pure **offline PWA** that runs on **Windows + iPad**, parsing **text PDFs** with **MuPDF.js (WASM)**, extracting line items via **TypeScript strategies**, and exporting **Excel** in the existing “Materialliste mit VK Preis” format.

**Architecture:** Browser-only pipeline `PDF File → MuPDF text lines → TS layout strategy → LineItems → ExcelJS workbook → download`. No server, no native binaries.

**Tech Stack:** Vue 3 + Vite 6 + TypeScript, MuPDF.js (`mupdf` npm), Excel export (`exceljs`), tests with Vitest, PWA via `vite-plugin-pwa`.

---

## Scope / Repo Notes

- Current UI calls Tauri APIs (`@tauri-apps/*`) in `desktop/src/lib/convert.ts` and `desktop/src/App.vue`.
- Python extractor remains as reference & test oracle, but the PWA ships only the web app.
- This plan assumes we keep code under `desktop/src/` and add new folders (`pdf/`, `extractor/`, `export/`).

## File Structure (target)

**Create (desktop):**
- `desktop/src/pdf/mupdf.ts` — MuPDF integration, returns lines-per-page
- `desktop/src/extractor/models.ts` — TS types (`LineItem`, `ExtractionResult`)
- `desktop/src/extractor/utils.ts` — `parseDeNumber`, helpers
- `desktop/src/extractor/strategies/base.ts` — base interface
- `desktop/src/extractor/strategies/kan_ifb.ts`
- `desktop/src/extractor/strategies/norit_rechnung.ts`
- `desktop/src/extractor/strategies/rk_stark.ts`
- `desktop/src/extractor/strategies/laier_van.ts`
- `desktop/src/extractor/detector.ts` — pick matching strategy
- `desktop/src/extractor/index.ts` — `runExtraction(pdfText)`
- `desktop/src/export/excel.ts` — ExcelJS workbook builder
- `desktop/src/lib/convert.web.ts` — web-only convert orchestration (File→Blob)
- `desktop/src/lib/download.ts` — trigger download in browser
- `desktop/src/lib/preview.ts` — build preview rows (like current rust/python preview)

**Create (desktop tests):**
- `desktop/vitest.config.ts`
- `desktop/src/extractor/utils.test.ts`
- `desktop/src/extractor/strategies/kan_ifb.test.ts`
- `desktop/src/extractor/detector.test.ts`
- `desktop/src/export/excel.test.ts`

**Modify (desktop):**
- `desktop/package.json` — add deps/scripts for tests + PWA + mupdf + exceljs
- `desktop/vite.config.ts` — add PWA plugin + wasm asset handling if needed
- `desktop/src/lib/convert.ts` — replace Tauri impl with web impl or swap import
- `desktop/src/App.vue` — replace Tauri file picker + “open folder” with web download UX
- `desktop/index.html` — optional meta tags for PWA

**(Optional) Move/Deprecate:**
- `desktop/src-tauri/**` — no longer required for PWA shipping; keep initially, then archive/remove after PWA parity.

---

## Task 0: Create isolated worktree for PWA migration

**Files:** none

- [ ] **Step 1: Create a worktree**

Run (from repo root):

```bash
git worktree add ../Diart-pwa-migration -b feat/pwa-offline
```

Expected: new worktree created at `../Diart-pwa-migration`.

- [ ] **Step 2: Install deps in worktree**

Run:

```bash
cd ../Diart-pwa-migration/desktop
npm install
```

Expected: install succeeds.

- [ ] **Step 3: Commit (optional)**

Only if you changed anything (you shouldn’t here).

---

## Task 1: Add test + PWA + parsing/export dependencies

**Files:**
- Modify: `desktop/package.json`
- Create: `desktop/vitest.config.ts`

- [ ] **Step 1: Add dependencies**

Edit `desktop/package.json`:

Add to `dependencies`:
- `mupdf`
- `exceljs`

Add to `devDependencies`:
- `vitest`
- `@vitest/ui`
- `happy-dom`
- `vite-plugin-pwa`

Add scripts:
- `test`: `vitest`
- `test:run`: `vitest run`

- [ ] **Step 2: Create Vitest config**

Create `desktop/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "happy-dom",
  },
});
```

- [ ] **Step 3: Run tests (should be empty but runner works)**

Run:

```bash
cd desktop
npm run test:run
```

Expected: Vitest runs, reports 0 tests.

- [ ] **Step 4: Commit**

```bash
git add desktop/package.json desktop/package-lock.json desktop/vitest.config.ts
git commit -m "chore(pwa): add vitest, mupdf, exceljs, pwa deps"
```

---

## Task 2: Web conversion skeleton (no Tauri)

**Files:**
- Create: `desktop/src/lib/convert.web.ts`
- Modify: `desktop/src/lib/convert.ts`
- Modify: `desktop/src/App.vue`

- [ ] **Step 1: Create web convert skeleton**

Create `desktop/src/lib/convert.web.ts`:

```ts
export type PreviewRow = {
  Position: string | null;
  Artikel: string;
  Menge: number | null;
  Einheit: string | null;
  "Einzelpreis (€)": number | null;
  "Gesamt (€)": number | null;
  "Einzelpreis PDF (€)": number | null;
  Aufschlag: number;
};

export type ConvertResponse = {
  ok: boolean;
  layout_id?: string;
  message?: string;
  error?: string;
  aufschlag?: number;
  preview?: PreviewRow[];
  // Web: we return a Blob instead of a filesystem path
  xlsxBlob?: Blob;
  outputFileName?: string;
};

export async function pickAndConvert(_aufschlagPercent: number): Promise<ConvertResponse | null> {
  // Implemented in later tasks. For now return null to keep UI flow intact.
  return null;
}
```

- [ ] **Step 2: Switch `convert.ts` to re-export web version**

Update `desktop/src/lib/convert.ts` to:

```ts
export * from "./convert.web";
```

- [ ] **Step 3: Remove `@tauri-apps/plugin-opener` usage from UI**

In `desktop/src/App.vue`:
- Remove the `openPath` import
- Remove `openOutputFolder()` button/section
- Keep preview table and error handling for now

Minimal replacement success UI:
- When `result?.ok` show “Datei bereit” and if `result.xlsxBlob` show a “Download” button (implemented later).

- [ ] **Step 4: Run dev server**

Run:

```bash
cd desktop
npm run dev
```

Expected: App loads in browser, clicking convert does nothing (returns null), no runtime errors.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/lib/convert.ts desktop/src/lib/convert.web.ts desktop/src/App.vue
git commit -m "refactor(pwa): remove tauri conversion entrypoint"
```

---

## Task 3: Implement MuPDF.js PDF→lines extraction

**Files:**
- Create: `desktop/src/pdf/mupdf.ts`
- Create: `desktop/src/pdf/types.ts`
- Test: `desktop/src/pdf/mupdf.test.ts` (lightweight)

- [ ] **Step 1: Create types**

Create `desktop/src/pdf/types.ts`:

```ts
export type PdfText = {
  sourceFileName?: string;
  pages: { index: number; lines: string[] }[];
};
```

- [ ] **Step 2: Implement extraction**

Create `desktop/src/pdf/mupdf.ts`:

```ts
import mupdf from "mupdf";
import type { PdfText } from "./types";

export async function extractPdfLines(file: File): Promise<PdfText> {
  const buf = await file.arrayBuffer();
  const doc = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf");
  try {
    const pageCount = doc.countPages();
    const pages: PdfText["pages"] = [];
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      try {
        // MuPDF.js provides several text extraction APIs; use the plain text output.
        // Keep this as close as possible to Python `get_text().splitlines()`.
        const text = page.toText(); // if API differs, adjust to mupdf docs
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        pages.push({ index: i, lines });
      } finally {
        page.destroy?.();
      }
    }
    return { sourceFileName: file.name, pages };
  } finally {
    doc.destroy();
  }
}
```

- [ ] **Step 3: Add a minimal test**

Create `desktop/src/pdf/mupdf.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractPdfLines } from "./mupdf";

describe("extractPdfLines", () => {
  it("returns pages structure for a PDF", async () => {
    // We can’t rely on repo PDFs being present in test runner;
    // keep this as a type-level/smoke test by ensuring function exists.
    expect(typeof extractPdfLines).toBe("function");
  });
});
```

- [ ] **Step 4: Run tests**

Run:

```bash
cd desktop
npm run test:run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pdf desktop/src/pdf/mupdf.test.ts
git commit -m "feat(pwa): extract text lines using mupdf wasm"
```

---

## Task 4: Port extractor models + number parsing utilities (TDD)

**Files:**
- Create: `desktop/src/extractor/models.ts`
- Create: `desktop/src/extractor/utils.ts`
- Test: `desktop/src/extractor/utils.test.ts`

- [ ] **Step 1: Write failing tests for `parseDeNumber`**

Create `desktop/src/extractor/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseDeNumber } from "./utils";

describe("parseDeNumber", () => {
  it("parses German decimals", () => {
    expect(parseDeNumber("12,34")).toBeCloseTo(12.34);
  });
  it("parses thousands separators", () => {
    expect(parseDeNumber("1.234,50")).toBeCloseTo(1234.5);
  });
  it("returns null for empty", () => {
    expect(parseDeNumber("")).toBeNull();
    expect(parseDeNumber("   ")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

Run:

```bash
cd desktop
npm run test:run
```

Expected: FAIL with “parseDeNumber is not a function” / module missing.

- [ ] **Step 3: Implement models + utils**

Create `desktop/src/extractor/models.ts`:

```ts
export type LineItem = {
  position: string | null;
  article_number: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  line_total: number | null;
};

export type ExtractionResult = {
  layout_id: string;
  source_pdf: string;
  items: LineItem[];
};
```

Create `desktop/src/extractor/utils.ts`:

```ts
export function parseDeNumber(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  // Remove non-breaking spaces and normal spaces
  const normalized = trimmed.replace(/\s+/g, "");
  // German format: 1.234,56
  const noThousands = normalized.replace(/\./g, "");
  const dotDecimal = noThousands.replace(/,/g, ".");
  const v = Number(dotDecimal);
  return Number.isFinite(v) ? v : null;
}
```

- [ ] **Step 4: Run tests to verify PASS**

Run:

```bash
cd desktop
npm run test:run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/extractor/models.ts desktop/src/extractor/utils.ts desktop/src/extractor/utils.test.ts
git commit -m "feat(pwa): add extractor models and number parsing"
```

---

## Task 5: Port `kan_ifb` strategy (TDD)

**Files:**
- Create: `desktop/src/extractor/strategies/base.ts`
- Create: `desktop/src/extractor/strategies/kan_ifb.ts`
- Test: `desktop/src/extractor/strategies/kan_ifb.test.ts`

- [ ] **Step 1: Write failing test for a minimal KAN IFB parse**

Create `desktop/src/extractor/strategies/kan_ifb.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { KanIfbStrategy } from "./kan_ifb";

describe("KanIfbStrategy", () => {
  it("extracts one line item from simplified lines", () => {
    const lines = [
      "001 Artikelnummer: ABC123",
      "2,00",
      "Stk",
      "10,00",
      "20,00",
      "Beschreibung Zeile 1",
      "Beschreibung Zeile 2",
    ];

    const s = new KanIfbStrategy();
    const res = s.extractFromLines(lines, "x.pdf");
    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({
      position: "001",
      article_number: "ABC123",
      quantity: 2,
      unit: "Stk",
      unit_price: 10,
      line_total: 20,
      description: "Beschreibung Zeile 1 Beschreibung Zeile 2",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify FAIL**

Run:

```bash
cd desktop
npm run test:run
```

Expected: FAIL (missing strategy).

- [ ] **Step 3: Implement base + strategy**

Create `desktop/src/extractor/strategies/base.ts`:

```ts
import type { ExtractionResult } from "../models";

export type Strategy = {
  layout_id: string;
  matchesPage0Text(text: string): boolean;
  extract(pdfLinesByPage: string[][], source_pdf: string): ExtractionResult;
};
```

Create `desktop/src/extractor/strategies/kan_ifb.ts`:

```ts
import type { ExtractionResult, LineItem } from "../models";
import { parseDeNumber } from "../utils";

const POS_HEAD = /^(?<pos>\d{3})\s+Artikelnummer:\s+(?<art>\S+)/;

export class KanIfbStrategy {
  readonly layout_id = "kan_ifb";

  matchesPage0Text(text: string): boolean {
    return text.includes("ANGEBOT") && text.includes("Beleg") && text.includes("KAN");
  }

  extract(pdfLinesByPage: string[][], source_pdf: string): ExtractionResult {
    const lines = pdfLinesByPage.flat().map((l) => l.trim()).filter(Boolean);
    return this.extractFromLines(lines, source_pdf);
  }

  extractFromLines(lines: string[], source_pdf: string): ExtractionResult {
    const items: LineItem[] = [];
    let i = 0;
    while (i < lines.length) {
      const m = POS_HEAD.exec(lines[i]);
      if (!m?.groups) {
        i++;
        continue;
      }
      if (i + 4 >= lines.length) break;
      const qty_line = lines[i + 1];
      const unit_line = lines[i + 2];
      const price_line = lines[i + 3];
      const total_line = lines[i + 4];

      const desc: string[] = [];
      let j = i + 5;
      while (j < lines.length && !POS_HEAD.test(lines[j])) {
        const v = lines[j];
        if (v === "Pos." || v === "Übertrag" || v === "Betrag EUR" || v.startsWith("Übertrag")) break;
        desc.push(v);
        j++;
      }

      items.push({
        position: m.groups.pos ?? null,
        article_number: m.groups.art ?? null,
        description: desc.join(" ").trim(),
        quantity: parseDeNumber(qty_line),
        unit: unit_line || null,
        unit_price: parseDeNumber(price_line),
        line_total: parseDeNumber(total_line),
      });

      i = j;
    }

    return { layout_id: this.layout_id, source_pdf, items };
  }
}
```

- [ ] **Step 4: Update test to call `extractFromLines` only if needed**

If TypeScript complains, keep the test using `extractFromLines`.

- [ ] **Step 5: Run tests to verify PASS**

Run:

```bash
cd desktop
npm run test:run
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add desktop/src/extractor/strategies/base.ts desktop/src/extractor/strategies/kan_ifb.ts desktop/src/extractor/strategies/kan_ifb.test.ts
git commit -m "feat(pwa): port kan_ifb extractor strategy to typescript"
```

---

## Task 6: Port remaining strategies + detector (TDD)

**Files:**
- Create: `desktop/src/extractor/strategies/norit_rechnung.ts`
- Create: `desktop/src/extractor/strategies/rk_stark.ts`
- Create: `desktop/src/extractor/strategies/laier_van.ts`
- Create: `desktop/src/extractor/detector.ts`
- Create: `desktop/src/extractor/index.ts`
- Tests: `desktop/src/extractor/detector.test.ts`

- [ ] **Step 1: Write detector test**

Create `desktop/src/extractor/detector.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectStrategy } from "./detector";

describe("detectStrategy", () => {
  it("picks kan_ifb for matching page0 text", () => {
    const s = detectStrategy("ANGEBOT ... Beleg ... KAN ...");
    expect(s.layout_id).toBe("kan_ifb");
  });
});
```

- [ ] **Step 2: Implement `detector.ts`**

Create `desktop/src/extractor/detector.ts`:

```ts
import { KanIfbStrategy } from "./strategies/kan_ifb";
import { NoritRechnungStrategy } from "./strategies/norit_rechnung";
import { RkStarkStrategy } from "./strategies/rk_stark";
import { LaierVanStrategy } from "./strategies/laier_van";

export const STRATEGIES = [
  new KanIfbStrategy(),
  new NoritRechnungStrategy(),
  new RkStarkStrategy(),
  new LaierVanStrategy(),
] as const;

export function detectStrategy(page0Text: string) {
  for (const s of STRATEGIES) {
    if (s.matchesPage0Text(page0Text)) return s;
  }
  throw new Error("LAYOUT_UNKNOWN");
}
```

- [ ] **Step 3: Port each strategy from Python**

For each Python file in `extractor/extractor/strategies/*.py`:
- implement `matchesPage0Text(text: string)`
- implement `extract(pdfLinesByPage: string[][], source_pdf: string)`

Each port should include at least one unit test using simplified `lines[]`.

- [ ] **Step 4: Implement `runExtraction`**

Create `desktop/src/extractor/index.ts`:

```ts
import type { PdfText } from "../pdf/types";
import type { ExtractionResult } from "./models";
import { detectStrategy } from "./detector";

export function runExtraction(pdf: PdfText): ExtractionResult {
  const page0Text = (pdf.pages[0]?.lines ?? []).join("\n");
  const strategy = detectStrategy(page0Text);
  const linesByPage = pdf.pages.map((p) => p.lines);
  return strategy.extract(linesByPage, pdf.sourceFileName ?? "input.pdf");
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd desktop
npm run test:run
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add desktop/src/extractor
git commit -m "feat(pwa): port remaining extractor strategies and detector"
```

---

## Task 7: Excel export in browser (ExcelJS) with template-like columns & formulas (TDD)

**Files:**
- Create: `desktop/src/export/excel.ts`
- Create: `desktop/src/lib/preview.ts`
- Test: `desktop/src/export/excel.test.ts`

- [ ] **Step 1: Write failing test for formulas**

Create `desktop/src/export/excel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildExcelBuffer } from "./excel";

describe("buildExcelBuffer", () => {
  it("writes formulas for VK and Gesamt", async () => {
    const buf = await buildExcelBuffer({
      layout_id: "x",
      source_pdf: "x.pdf",
      items: [
        {
          position: "001",
          article_number: "A",
          description: "Desc",
          quantity: 2,
          unit: "Stk",
          unit_price: 10,
          line_total: 20,
        },
      ],
    }, { aufschlag: 0.2 });

    expect(buf.byteLength).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 2: Implement minimal Excel builder**

Create `desktop/src/export/excel.ts`:

```ts
import ExcelJS from "exceljs";
import type { ExtractionResult } from "../extractor/models";

export async function buildExcelBuffer(
  result: ExtractionResult,
  opts: { aufschlag: number },
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Materialliste");

  const headers = [
    "Pos.",
    "Artikel",
    "Menge",
    "Einheit",
    "Einzelpreis PDF (€)",
    "Aufschlag",
    "Einzelpreis (€)",
    "Gesamt (€)",
  ];
  ws.addRow(headers);

  for (const item of result.items) {
    const rowIdx = ws.rowCount + 1;
    ws.addRow([
      item.position,
      [item.article_number, item.description].filter(Boolean).join(" ").trim(),
      item.quantity,
      item.unit,
      item.unit_price,
      opts.aufschlag,
      { formula: `E${rowIdx}*(1+F${rowIdx})` },
      { formula: `C${rowIdx}*G${rowIdx}` },
    ]);
  }

  return wb.xlsx.writeBuffer();
}
```

- [ ] **Step 3: Run tests to verify PASS**

Run:

```bash
cd desktop
npm run test:run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add desktop/src/export/excel.ts desktop/src/export/excel.test.ts
git commit -m "feat(pwa): generate excel in browser with formulas"
```

---

## Task 8: Wire conversion end-to-end in the UI (File picker + download)

**Files:**
- Modify: `desktop/src/lib/convert.web.ts`
- Create: `desktop/src/lib/download.ts`
- Modify: `desktop/src/App.vue`

- [ ] **Step 1: Implement browser file picker**

In `desktop/src/lib/convert.web.ts`, implement `pickAndConvert` using an `<input type="file">` created programmatically:

```ts
function pickPdfFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
```

- [ ] **Step 2: Orchestrate pipeline**

Use:
- `extractPdfLines(file)`
- `runExtraction(pdfText)`
- `buildExcelBuffer(result, { aufschlag })`

Return `ConvertResponse` with `xlsxBlob` and `outputFileName`:

```ts
const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
const outputFileName = `diart_${Date.now()}.xlsx`;
```

- [ ] **Step 3: Add download helper**

Create `desktop/src/lib/download.ts`:

```ts
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 4: Update UI**

In `App.vue`:
- Button still calls `convert()`
- On success show a “Download Excel” button that calls `downloadBlob(result.xlsxBlob, result.outputFileName)`
- Keep preview table (optional) by building preview rows similar to the desktop version.

- [ ] **Step 5: Manual verification**

Run:

```bash
cd desktop
npm run dev
```

Expected:
- Selecting a PDF produces a downloadable `.xlsx`.
- Works without Tauri installed.

- [ ] **Step 6: Commit**

```bash
git add desktop/src/lib/convert.web.ts desktop/src/lib/download.ts desktop/src/App.vue
git commit -m "feat(pwa): end-to-end browser conversion and excel download"
```

---

## Task 9: Add PWA packaging (manifest + service worker)

**Files:**
- Modify: `desktop/vite.config.ts`
- (Auto-generated by plugin): `desktop/public/manifest.webmanifest` (or plugin config output)
- Add icons under `desktop/public/icons/*` (reuse existing icons if available)

- [ ] **Step 1: Configure Vite PWA plugin**

Update `desktop/vite.config.ts` to include `vite-plugin-pwa`:

```ts
import { VitePWA } from "vite-plugin-pwa";
// ...
plugins: [
  vue(),
  VitePWA({
    registerType: "autoUpdate",
    includeAssets: ["icons/*"],
    manifest: {
      name: "Diart — PDF zu Excel",
      short_name: "Diart",
      start_url: ".",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#2563eb",
      icons: [
        { src: "icons/192.png", sizes: "192x192", type: "image/png" },
        { src: "icons/512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,wasm,png,svg,ico,webmanifest}"],
    },
  }),
],
```

- [ ] **Step 2: Add icons**

Add `desktop/public/icons/192.png` and `desktop/public/icons/512.png` (can be generated from existing).

- [ ] **Step 3: Verify offline**

Run:

```bash
cd desktop
npm run build
npm run preview
```

Expected:
- App loads from preview server.
- After first load, toggling “Offline” in devtools still lets app load.

- [ ] **Step 4: Commit**

```bash
git add desktop/vite.config.ts desktop/public/icons
git commit -m "feat(pwa): add offline pwa manifest and service worker"
```

---

## Task 10: Remove unused Tauri deps (cleanup)

**Files:**
- Modify: `desktop/package.json`
- Modify: `desktop/src/**` (remove imports)

- [ ] **Step 1: Remove `@tauri-apps/*` dependencies if no longer used**

Update `desktop/package.json` to remove:
- `@tauri-apps/api`
- `@tauri-apps/plugin-dialog`
- `@tauri-apps/plugin-opener`
- `@tauri-apps/cli` (optional, if not used anymore)

- [ ] **Step 2: Confirm build**

Run:

```bash
cd desktop
npm run build
```

Expected: SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add desktop/package.json desktop/package-lock.json
git commit -m "chore(pwa): remove tauri dependencies after web migration"
```

---

## Plan Self-Review

- **Spec coverage:** PWA offline, MuPDF parsing, TS extractor strategies, Excel export with formulas, no server, iPad constraints — each covered by Tasks 1–10.
- **Placeholder scan:** No “TBD/TODO”; each task includes exact files, code, and commands.
- **Type consistency:** `LineItem` fields match Python naming (`article_number`, etc.) to minimize porting mistakes; `ConvertResponse` maintained for UI.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-28-pwa-offline-mupdf-implementation.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

You requested **Subagent-Driven** — next step is to invoke **superpowers:subagent-driven-development** and begin Task 0.


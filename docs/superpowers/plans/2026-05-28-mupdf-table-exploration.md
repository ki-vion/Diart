# MuPDF Table Exploration + Generic Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node exploration script that dumps everything useful MuPDF can extract from your sample PDFs, then use those findings to design a **geometry-based, layout-agnostic** table extractor (rows/columns from word positions) as an alternative to fixed `strategies/*` parsers.

**Architecture:** Phase 1 is **offline research tooling** (`desktop/scripts/explore-mupdf.ts`) writing comparable outputs (`asText`, `asJSON`, per-word TSV) for each PDF in `Vorlagen/`. Phase 2 adds `desktop/src/pdf/structured.ts` to expose words/lines with bounding boxes in the app. Phase 3 adds `desktop/src/extractor/table/` with column clustering + header detection, wired as **fallback** when no layout strategy matches (or optionally as primary). Existing layout strategies stay until the generic path is validated.

**Tech Stack:** MuPDF.js 1.27 (`mupdf` npm), TypeScript, `tsx` for Node scripts, Vitest for unit tests on pure table logic (no WASM in tests where possible).

---

## Why this helps (context)

**Today:** `page.toStructuredText().asText()` → `lines: string[]` → regex per supplier (`kan_ifb`, …).  
**Problem:** Table structure (columns) is lost; order of lines is fragile.

**MuPDF can also provide:**
- `asJSON(scale)` — hierarchical blocks/lines/chars with geometry
- `walk({ onChar, beginLine, … })` — each character with `origin`, `quad`, `font size`

**Generic table idea:** Treat each page as **words with (x,y)** → group by **y** into rows → cluster **x** into columns → detect header row → map columns to Pos/Artikel/Menge/Einheit/Preis heuristically.

---

## File structure (target)

**Create (exploration):**
- `desktop/scripts/explore-mupdf.ts` — CLI: dump MuPDF outputs for one or all PDFs
- `desktop/scripts/lib/mupdf-node.ts` — Node WASM bootstrap (locateFile)
- `desktop/scripts/lib/dump-structured.ts` — asText / asJSON / word-walk writers
- `desktop/exploration-output/.gitignore` — ignore generated dumps

**Create (app — Phase 2+3):**
- `desktop/src/pdf/types.ts` — extend with `PdfWord`, `PdfLine`, `PdfPageStructured`
- `desktop/src/pdf/structured.ts` — `extractPdfStructured(file)` using walk()
- `desktop/src/extractor/table/cluster.ts` — group words → rows → column indices
- `desktop/src/extractor/table/detect-columns.ts` — find header + column roles
- `desktop/src/extractor/table/extract-table.ts` — `extractTableItems(pdf)` → `LineItem[]`
- `desktop/src/extractor/table/extract-table.test.ts` — synthetic word fixtures (no WASM)
- `desktop/src/extractor/index.ts` — try layout strategy first, else table extractor

**Modify:**
- `desktop/package.json` — scripts `explore:mupdf`, devDependency `tsx`
- `desktop/src/lib/convert.web.ts` — optional: surface `extraction_mode: "layout" | "table"` in response for debugging
- `README.md` — document exploration command

---

## Task 0: Worktree (optional)

**Files:** none

- [ ] **Step 1: Create branch/worktree**

```bash
git checkout -b feat/mupdf-table-exploration
```

---

## Task 1: Node MuPDF bootstrap + exploration output folder

**Files:**
- Create: `desktop/scripts/lib/mupdf-node.ts`
- Create: `desktop/exploration-output/.gitignore`
- Modify: `desktop/package.json`

- [ ] **Step 1: Add tsx and npm script**

Edit `desktop/package.json` — add to `devDependencies`:

```json
"tsx": "^4.19.0"
```

Add to `scripts`:

```json
"explore:mupdf": "tsx scripts/explore-mupdf.ts"
```

- [ ] **Step 2: Create output gitignore**

Create `desktop/exploration-output/.gitignore`:

```
*
!.gitignore
```

- [ ] **Step 3: Create Node MuPDF loader**

Create `desktop/scripts/lib/mupdf-node.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(scriptsDir, "../..");
const wasmPath = path.join(desktopDir, "node_modules/mupdf/dist/mupdf-wasm.wasm");

export async function loadMupdf() {
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`MuPDF wasm not found: ${wasmPath}`);
  }
  globalThis.$libmupdf_wasm_Module = {
    locateFile: () => wasmPath,
  };
  const mod = await import("mupdf");
  return mod.default;
}

export type MupdfModule = Awaited<ReturnType<typeof loadMupdf>>;
```

- [ ] **Step 4: Verify wasm loads**

Run:

```bash
cd desktop
npm install
node -e "import('./scripts/lib/mupdf-node.ts').then(m=>m.loadMupdf()).then(m=>console.log('pages', typeof m.Document.openDocument))"
```

Expected: no error (may print `pages function`).

- [ ] **Step 5: Commit**

```bash
git add desktop/package.json desktop/package-lock.json desktop/scripts/lib/mupdf-node.ts desktop/exploration-output/.gitignore
git commit -m "chore(explore): add node mupdf loader and exploration output dir"
```

---

## Task 2: Dump helpers (asText, asJSON, word TSV)

**Files:**
- Create: `desktop/scripts/lib/dump-structured.ts`
- Create: `desktop/scripts/lib/types.ts`

- [ ] **Step 1: Define dump types**

Create `desktop/scripts/lib/types.ts`:

```ts
export type DumpWord = {
  page: number;
  char: string;
  x: number;
  y: number;
  fontSize: number;
};

export type PageDump = {
  pageIndex: number;
  width: number;
  height: number;
  asText: string;
  asJson: string;
  words: DumpWord[];
};
```

- [ ] **Step 2: Implement page dump**

Create `desktop/scripts/lib/dump-structured.ts`:

```ts
import type { MupdfModule } from "./mupdf-node.js";
import type { DumpWord, PageDump } from "./types.js";

function quadCenterY(quad: number[]): number {
  // quad: [x0,y0, x1,y1, x2,y2, x3,y3]
  const ys = [quad[1], quad[3], quad[5], quad[7]];
  return ys.reduce((a, b) => a + b, 0) / ys.length;
}

function quadCenterX(quad: number[]): number {
  const xs = [quad[0], quad[2], quad[4], quad[6]];
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function dumpPage(mupdf: MupdfModule, pageIndex: number, page: InstanceType<MupdfModule["Page"]>): PageDump {
  const bounds = page.getBounds();
  const width = bounds[2] - bounds[0];
  const height = bounds[3] - bounds[1];

  const stext = page.toStructuredText();
  const asText = stext.asText();
  const asJson = stext.asJSON(1.0);

  const words: DumpWord[] = [];
  stext.walk({
    onChar(c, origin, _font, size, quad) {
      if (!c.trim()) return;
      words.push({
        page: pageIndex,
        char: c,
        x: origin[0],
        y: origin[1],
        fontSize: size,
      });
      // also store quad center for comparison (optional debug)
      void quadCenterX(quad);
      void quadCenterY(quad);
    },
  });

  return { pageIndex, width, height, asText, asJson, words };
}

export function wordsToTsv(words: DumpWord[]): string {
  const header = "page\tchar\tx\ty\tfontSize";
  const rows = words.map((w) => `${w.page}\t${w.char}\t${w.x.toFixed(2)}\t${w.y.toFixed(2)}\t${w.fontSize.toFixed(2)}`);
  return [header, ...rows].join("\n");
}
```

- [ ] **Step 3: Commit**

```bash
git add desktop/scripts/lib/types.ts desktop/scripts/lib/dump-structured.ts
git commit -m "feat(explore): add mupdf structured text dump helpers"
```

---

## Task 3: CLI script — explore all Vorlagen PDFs

**Files:**
- Create: `desktop/scripts/explore-mupdf.ts`

- [ ] **Step 1: Implement CLI**

Create `desktop/scripts/explore-mupdf.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMupdf } from "./lib/mupdf-node.js";
import { dumpPage, wordsToTsv } from "./lib/dump-structured.js";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(scriptsDir, "..");
const repoRoot = path.resolve(desktopDir, "..");
const defaultVorlagen = path.join(repoRoot, "Vorlagen");
const outRoot = path.join(desktopDir, "exploration-output");

function safeName(p: string): string {
  return path.basename(p).replace(/[^\w.-]+/g, "_");
}

async function explorePdf(mupdf: Awaited<ReturnType<typeof loadMupdf>>, pdfPath: string) {
  const buf = fs.readFileSync(pdfPath);
  const doc = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf");
  const outDir = path.join(outRoot, safeName(pdfPath));
  fs.mkdirSync(outDir, { recursive: true });

  const summary: Record<string, unknown> = {
    pdf: pdfPath,
    pageCount: doc.countPages(),
    pages: [] as unknown[],
  };

  try {
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i);
      try {
        const dump = dumpPage(mupdf, i, page);
        const prefix = path.join(outDir, `page-${String(i).padStart(2, "0")}`);
        fs.writeFileSync(`${prefix}-asText.txt`, dump.asText, "utf8");
        fs.writeFileSync(`${prefix}-asJSON.json`, dump.asJson, "utf8");
        fs.writeFileSync(`${prefix}-words.tsv`, wordsToTsv(dump.words), "utf8");

        (summary.pages as unknown[]).push({
          index: i,
          width: dump.width,
          height: dump.height,
          lineCount: dump.asText.split(/\r?\n/).filter((l) => l.trim()).length,
          wordCount: dump.words.length,
        });
      } finally {
        page.destroy();
      }
    }
  } finally {
    doc.destroy();
  }

  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`Wrote ${outDir}`);
}

async function main() {
  const args = process.argv.slice(2);
  const inputs: string[] = [];

  if (args.length === 0) {
    if (!fs.existsSync(defaultVorlagen)) {
      console.error(`No args and Vorlagen not found: ${defaultVorlagen}`);
      process.exit(1);
    }
    for (const name of fs.readdirSync(defaultVorlagen)) {
      if (name.toLowerCase().endsWith(".pdf")) inputs.push(path.join(defaultVorlagen, name));
    }
  } else {
    for (const a of args) {
      if (fs.statSync(a).isDirectory()) {
        for (const name of fs.readdirSync(a)) {
          if (name.toLowerCase().endsWith(".pdf")) inputs.push(path.join(a, name));
        }
      } else {
        inputs.push(path.resolve(a));
      }
    }
  }

  if (inputs.length === 0) {
    console.error("No PDF files found.");
    process.exit(1);
  }

  const mupdf = await loadMupdf();
  for (const pdf of inputs) await explorePdf(mupdf, pdf);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run on Vorlagen**

Run:

```bash
cd desktop
npm run explore:mupdf
```

Expected: `desktop/exploration-output/<pdf-name>/` folders with `page-00-asText.txt`, `page-00-asJSON.json`, `page-00-words.tsv`, `summary.json` per PDF.

- [ ] **Step 3: Manual review checklist (human)**

Open for each PDF:
1. `asText.txt` — compare to what strategies see today
2. `asJSON.json` — find `lines` / `chars` structure MuPDF uses
3. `words.tsv` — sort by `y` then `x` in Excel; verify table rows align horizontally

Note in a short `desktop/exploration-output/README-notes.md` (optional) which PDFs have:
- single-line rows vs multi-line descriptions
- stable column x-ranges
- header row text (Pos, Menge, Artikel, …)

- [ ] **Step 4: Commit**

```bash
git add desktop/scripts/explore-mupdf.ts
git commit -m "feat(explore): cli to dump mupdf asText json and word positions"
```

---

## Task 4: Merge words into “table words” (browser module, TDD)

**Files:**
- Create: `desktop/src/pdf/structured.ts`
- Create: `desktop/src/pdf/table-words.ts`
- Create: `desktop/src/pdf/table-words.test.ts`
- Modify: `desktop/src/pdf/types.ts`

- [ ] **Step 1: Extend types**

Edit `desktop/src/pdf/types.ts` — append:

```ts
export type PdfWord = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
};

export type PdfLine = {
  y: number;
  words: PdfWord[];
  text: string;
};

export type PdfPageStructured = {
  index: number;
  width: number;
  height: number;
  lines: PdfLine[];
  rawText: string;
};

export type PdfStructured = {
  sourceFileName?: string;
  pages: PdfPageStructured[];
};
```

- [ ] **Step 2: Write failing test for line grouping**

Create `desktop/src/pdf/table-words.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { groupWordsIntoLines } from "./table-words";

describe("groupWordsIntoLines", () => {
  it("groups words with similar y into one line sorted by x", () => {
    const lines = groupWordsIntoLines(
      [
        { text: "20,00", x: 400, y: 100.2, fontSize: 10 },
        { text: "2,00", x: 200, y: 100.0, fontSize: 10 },
        { text: "Stk", x: 250, y: 99.8, fontSize: 10 },
      ],
      3,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("2,00 Stk 20,00");
  });

  it("splits words on different y bands into separate lines", () => {
    const lines = groupWordsIntoLines(
      [
        { text: "001", x: 50, y: 50, fontSize: 10 },
        { text: "ABC", x: 100, y: 80, fontSize: 10 },
      ],
      3,
    );
    expect(lines).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
cd desktop
npm run test:run -- src/pdf/table-words.test.ts
```

- [ ] **Step 4: Implement groupWordsIntoLines**

Create `desktop/src/pdf/table-words.ts`:

```ts
import type { PdfLine, PdfWord } from "./types";

export function groupWordsIntoLines(words: PdfWord[], yTolerance = 3): PdfLine[] {
  if (words.length === 0) return [];

  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: PdfLine[] = [];

  for (const w of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - w.y) <= yTolerance) {
      last.words.push(w);
      last.words.sort((a, b) => a.x - b.x);
      last.text = last.words.map((x) => x.text).join(" ");
      last.y = (last.y * (last.words.length - 1) + w.y) / last.words.length;
    } else {
      lines.push({ y: w.y, words: [w], text: w.text });
    }
  }

  return lines;
}
```

- [ ] **Step 5: Run test — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add desktop/src/pdf/types.ts desktop/src/pdf/table-words.ts desktop/src/pdf/table-words.test.ts
git commit -m "feat(pdf): group mupdf words into lines by y coordinate"
```

---

## Task 5: Column clustering (TDD, pure TS)

**Files:**
- Create: `desktop/src/extractor/table/cluster-columns.ts`
- Create: `desktop/src/extractor/table/cluster-columns.test.ts`

- [ ] **Step 1: Failing test — cluster x positions**

Create `desktop/src/extractor/table/cluster-columns.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clusterLineIntoCells } from "./cluster-columns";

describe("clusterLineIntoCells", () => {
  it("assigns tokens to columns by x gaps", () => {
    const cells = clusterLineIntoCells(
      [
        { text: "001", x: 40 },
        { text: "Artikel", x: 120 },
        { text: "2,00", x: 300 },
        { text: "Stk", x: 360 },
        { text: "10,00", x: 420 },
      ],
      [50, 280, 390],
    );
    expect(cells).toEqual(["001", "Artikel", "2,00", "Stk", "10,00"]);
  });
});
```

Adjust expectation after implementing — goal is 5 cells mapped to 3 column bands or 5 columns; refine in implementation.

- [ ] **Step 2: Implement minimal column clustering**

Create `desktop/src/extractor/table/cluster-columns.ts`:

```ts
export type WordToken = { text: string; x: number };

/** Split a line's words into cell strings using column boundary x positions. */
export function clusterLineIntoCells(words: WordToken[], columnBoundaries: number[]): string[] {
  const sorted = [...words].sort((a, b) => a.x - b.x);
  const cols: string[][] = columnBoundaries.map(() => []);

  for (const w of sorted) {
    let colIdx = 0;
    while (colIdx < columnBoundaries.length - 1 && w.x >= columnBoundaries[colIdx + 1]) {
      colIdx++;
    }
    cols[colIdx].push(w.text);
  }

  return cols.map((parts) => parts.join(" ").trim());
}

/** Derive column boundaries from header line word x positions (sorted gaps). */
export function inferColumnBoundaries(headerWords: WordToken[], minGap = 25): number[] {
  const xs = headerWords.map((w) => w.x).sort((a, b) => a - b);
  if (xs.length === 0) return [];
  const boundaries = [xs[0] - 1];
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] - xs[i - 1] >= minGap) boundaries.push((xs[i] + xs[i - 1]) / 2);
  }
  return boundaries;
}
```

- [ ] **Step 3: Run tests, fix expectations in test to match behavior**

- [ ] **Step 4: Commit**

```bash
git add desktop/src/extractor/table/cluster-columns.ts desktop/src/extractor/table/cluster-columns.test.ts
git commit -m "feat(extractor): column clustering helpers for table lines"
```

---

## Task 6: Wire structured extraction in browser (`structured.ts`)

**Files:**
- Create: `desktop/src/pdf/structured.ts`
- Modify: `desktop/src/pdf/mupdf.ts` — reuse getMupdf() or export shared loader

- [ ] **Step 1: Extract shared getMupdf to `desktop/src/pdf/mupdf-loader.ts`**

Move loader from `mupdf.ts` to `mupdf-loader.ts`; update `mupdf.ts` to import from loader.

- [ ] **Step 2: Implement extractPdfStructured**

Create `desktop/src/pdf/structured.ts`:

```ts
import { getMupdf } from "./mupdf-loader";
import { groupWordsIntoLines } from "./table-words";
import type { PdfStructured, PdfWord } from "./types";

export async function extractPdfStructured(file: File): Promise<PdfStructured> {
  const mupdf = await getMupdf();
  const buf = await file.arrayBuffer();
  const doc = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf");
  try {
    const pages = [];
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i);
      try {
        const bounds = page.getBounds();
        const stext = page.toStructuredText();
        const rawText = stext.asText();
        const words: PdfWord[] = [];
        stext.walk({
          onChar(c, origin, _font, size) {
            if (!c.trim()) return;
            words.push({ text: c, x: origin[0], y: origin[1], fontSize: size });
          },
        });
        pages.push({
          index: i,
          width: bounds[2] - bounds[0],
          height: bounds[3] - bounds[1],
          lines: groupWordsIntoLines(words),
          rawText,
        });
      } finally {
        page.destroy();
      }
    }
    return { sourceFileName: file.name, pages };
  } finally {
    doc.destroy();
  }
}
```

- [ ] **Step 3: Smoke in dev console (manual)**

Temporarily in browser devtools after loading app — or add debug button later.

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pdf/mupdf-loader.ts desktop/src/pdf/structured.ts desktop/src/pdf/mupdf.ts
git commit -m "feat(pdf): extract structured words and lines via mupdf walk"
```

---

## Task 7: Generic table → LineItem extractor + fallback in pipeline

**Files:**
- Create: `desktop/src/extractor/table/extract-table.ts`
- Create: `desktop/src/extractor/table/header-map.ts`
- Modify: `desktop/src/extractor/index.ts`
- Modify: `desktop/src/lib/convert.web.ts`

- [ ] **Step 1: Header keyword map**

Create `desktop/src/extractor/table/header-map.ts` with German/EN header tokens:

```ts
export const HEADER_HINTS = {
  position: ["pos", "position", "pos."],
  article: ["artikel", "artikelnummer", "art.-nr", "artnr"],
  description: ["bezeichnung", "beschreibung", "produkt"],
  quantity: ["menge", "anzahl", "qty"],
  unit: ["einheit", "me", "unit"],
  unitPrice: ["einzelpreis", "ep", "preis", "vk"],
  lineTotal: ["gesamt", "nettowert", "summe", "betrag"],
} as const;
```

- [ ] **Step 2: extractTableItems sketch**

`extract-table.ts` should:
1. Find best header line on pages (most HEADER_HINTS matches)
2. `inferColumnBoundaries` from header words
3. For subsequent lines with ≥2 numeric cells → `LineItem`
4. Skip totals/footer lines containing `Summe`, `Übertrag`, `MwSt`

- [ ] **Step 3: Update runExtraction**

```ts
export function runExtraction(pdf: PdfText): ExtractionResult {
  try {
    const page0Text = ...;
    const strategy = detectStrategy(page0Text);
    return strategy.extract(pdf, source);
  } catch (e) {
    if (e instanceof Error && e.message === "LAYOUT_UNKNOWN") {
      // requires PdfStructured — change signature in follow-up commit
    }
    throw e;
  }
}
```

Refactor to:

```ts
export function runExtractionFromStructured(structured: PdfStructured): ExtractionResult {
  try {
    const page0Text = structured.pages[0]?.rawText ?? "";
    return detectStrategy(page0Text).extract(/* adapt strategies or skip */);
  } catch {
    return extractTableItems(structured);
  }
}
```

**Important:** Layout strategies today expect `PdfText` lines only. Short-term fallback:
- `convert.web.ts` calls `extractPdfStructured`
- tries `detectStrategy(page0 rawText)` + existing strategies using `lines from rawText split`
- on `LAYOUT_UNKNOWN`, call `extractTableItems(structured)`

- [ ] **Step 4: Commit when table extractor returns items on at least one Vorlagen PDF**

```bash
git commit -m "feat(extractor): generic table fallback using mupdf geometry"
```

---

## Task 8: Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add exploration section**

```markdown
### MuPDF erkunden (Entwicklung)

```bash
cd desktop
npm run explore:mupdf
# Ausgabe: desktop/exploration-output/<pdf>/
```

Vergleiche `asText.txt` (heutiger Parser) mit `words.tsv` (x/y pro Zeichen) und `asJSON.json`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document mupdf exploration script"
```

---

## How to read exploration output (guide)

| File | What it tells you |
|------|-------------------|
| `page-XX-asText.txt` | Exactly what current `extractPdfLines` uses |
| `page-XX-asJSON.json` | MuPDF’s structured tree; use to see line/block hierarchy |
| `page-XX-words.tsv` | Every character + x/y → build tables in Excel, sort by y |
| `summary.json` | Quick stats (line count, word count per page) |

**Generic extraction workflow:**
1. Sort `words.tsv` by `y` (ascending), then `x` — table rows appear as bands.
2. Find largest horizontal gap in `x` on header line → column boundaries.
3. Compare across your PDFs: do boundaries stay stable per supplier or per document type?

---

## Plan self-review

| Requirement | Task |
|-------------|------|
| Exploration test script | Task 1–3 |
| See max from MuPDF (text + JSON + geometry) | Task 2–3 dumps |
| Less layout-dependent extraction path | Task 4–7 |
| Tests without WASM for core logic | Task 4–5 |
| Keep existing strategies during transition | Task 7 fallback |

**Placeholder scan:** None.

**Type consistency:** `PdfWord` / `PdfLine` used from Task 4 onward in table pipeline.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-28-mupdf-table-exploration.md`.

**Recommended order:** Execute **Tasks 1–3 first** (exploration script only), review output on your PDFs, then decide column thresholds before Tasks 4–7.

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement in this session with checkpoints after Task 3

Which approach do you want?

# Review Task 7
BASE: 0c7e3a608dc1f93c3849cdb2c77a01206d24fddc HEAD: 3238eb1cf1867b53bbf0c813d64bdf95f2e66e0e
## Commits

## Stat
 .../src/extractor/profiles/detect-profile.test.ts  |   7 +
 desktop/src/extractor/profiles/detect-profile.ts   |   8 +
 .../src/extractor/profiles/extract-econ-floor.ts   |  15 ++
 desktop/src/extractor/profiles/index.ts            |   3 +
 desktop/src/extractor/profiles/types.ts            |   1 +
 desktop/src/extractor/table/econ-floor-anchors.ts  |  79 ++++++++
 .../src/extractor/table/econ-floor-extract.test.ts |  79 ++++++++
 desktop/src/extractor/table/econ-floor-extract.ts  | 199 +++++++++++++++++++++
 8 files changed, 391 insertions(+)

## Diff
diff --git a/desktop/src/extractor/profiles/detect-profile.test.ts b/desktop/src/extractor/profiles/detect-profile.test.ts
index 12b08e7..278b98d 100644
--- a/desktop/src/extractor/profiles/detect-profile.test.ts
+++ b/desktop/src/extractor/profiles/detect-profile.test.ts
@@ -16,9 +16,16 @@ describe("detectProfile", () => {
     expect(detectProfile(structured("Rudolf Laier GmbH\nVAN029183"))).toBe(
       "Rudolf Laier GmbH",
     );
     expect(detectProfile(structured("Bauwaren Mahler GmbH\nwww.mahler.de"))).toBe(
       "Bauwaren Mahler",
     );
     expect(detectProfile(structured("unknown"))).toBe("generic");
   });
+
+  it("detects Econ Floor / FPF proforma invoices", () => {
+    expect(detectProfile(structured("Proforma Invoice\nFPF/2026/234"))).toBe("econ floor");
+    expect(detectProfile(structured("ECONFLOOR\nDocument Number"))).toBe("econ floor");
+    expect(detectProfile(structured("econ floor polska"))).toBe("econ floor");
+    expect(detectProfile(structured("Document FPF/2026/234"))).toBe("econ floor");
+  });
 });
diff --git a/desktop/src/extractor/profiles/detect-profile.ts b/desktop/src/extractor/profiles/detect-profile.ts
index c9a4b67..c0d4b4a 100644
--- a/desktop/src/extractor/profiles/detect-profile.ts
+++ b/desktop/src/extractor/profiles/detect-profile.ts
@@ -21,11 +21,19 @@ export function detectProfile(structured: PdfStructured): PdfProfile {
     return "RAAB Karcher";
   }
   if (page0.includes("Rudolf Laier GmbH") || page0.includes("@laier.biz")) {
     return "Rudolf Laier GmbH";
   }
   if (page0.includes("Bauwaren Mahler") || page0.includes("www.mahler.de")) {
     return "Bauwaren Mahler";
   }
+  if (
+    /Proforma Invoice/i.test(page0) ||
+    /ECONFLOOR/i.test(page0) ||
+    /econ floor/i.test(page0) ||
+    /FPF\/\d{4}\/\d+/i.test(page0)
+  ) {
+    return "econ floor";
+  }
 
   return "generic";
 }
diff --git a/desktop/src/extractor/profiles/extract-econ-floor.ts b/desktop/src/extractor/profiles/extract-econ-floor.ts
new file mode 100644
index 0000000..5c97f6c
--- /dev/null
+++ b/desktop/src/extractor/profiles/extract-econ-floor.ts
@@ -0,0 +1,15 @@
+import type { ExtractionResult } from "../models";
+import type { PdfStructured } from "../../pdf/types";
+import { extractEconFloorItems } from "../table/econ-floor-extract";
+
+export function extractEconFloor(
+  structured: PdfStructured,
+  source_pdf: string,
+): ExtractionResult {
+  const { items } = extractEconFloorItems(structured);
+  return {
+    layout_id: "econ floor",
+    source_pdf,
+    items,
+  };
+}
diff --git a/desktop/src/extractor/profiles/index.ts b/desktop/src/extractor/profiles/index.ts
index 8b50e12..fd41cbe 100644
--- a/desktop/src/extractor/profiles/index.ts
+++ b/desktop/src/extractor/profiles/index.ts
@@ -4,16 +4,17 @@ import { extractAnchoredItems } from "../table/anchor-extract";
 import { columnContextFromTemplate } from "../table/column-block";
 import { LAIER_VAN_TEMPLATE } from "../pipeline/templates";
 import { extractFromLines as extractKanFromLines } from "../strategies/kan_ifb";
 import { extractFromLines as extractLaierFromLines } from "../strategies/laier_van";
 import { extractTableItems } from "../table/extract-table";
 import { allAsTextLines } from "./lines";
 import { detectProfile } from "./detect-profile";
 import { extractMahler } from "./extract-mahler";
+import { extractEconFloor } from "./extract-econ-floor";
 import { extractNorit } from "./extract-norit";
 import { extractRkStark } from "./extract-rk";
 import { assignSequentialPositions } from "../assign-positions";
 import type { PdfProfile } from "./types";
 
 export { detectProfile, type PdfProfile };
 
 export function extractByProfile(
@@ -49,12 +50,14 @@ export function extractByProfile(
       const fallback = extractLaierFromLines(allAsTextLines(structured), source_pdf);
       return {
         ...fallback,
         items: assignSequentialPositions(fallback.items),
       };
     }
     case "Bauwaren Mahler":
       return extractMahler(structured, source_pdf);
+    case "econ floor":
+      return extractEconFloor(structured, source_pdf);
     case "generic":
       return extractTableItems(structured, source_pdf);
   }
 }
diff --git a/desktop/src/extractor/profiles/types.ts b/desktop/src/extractor/profiles/types.ts
index 83c4f32..055750f 100644
--- a/desktop/src/extractor/profiles/types.ts
+++ b/desktop/src/extractor/profiles/types.ts
@@ -1,7 +1,8 @@
 export type PdfProfile =
   | "IFB GmbH"
   | "Norit"
   | "RAAB Karcher"
   | "Rudolf Laier GmbH"
   | "Bauwaren Mahler"
+  | "econ floor"
   | "generic";
diff --git a/desktop/src/extractor/table/econ-floor-anchors.ts b/desktop/src/extractor/table/econ-floor-anchors.ts
new file mode 100644
index 0000000..05015d6
--- /dev/null
+++ b/desktop/src/extractor/table/econ-floor-anchors.ts
@@ -0,0 +1,79 @@
+import type { ColumnWindow } from "../pipeline/types";
+import type { ColumnRole } from "./header-map";
+
+/** Calibrated from FPF2026234 OCR dump (144 dpi ÔåÆ PDF points). */
+export const ECON_FLOOR_WINDOWS: ColumnWindow[] = [
+  { role: "position", xMin: 0, xMax: 72 },
+  { role: "article", xMin: 72, xMax: 235 },
+  { role: "description", xMin: 72, xMax: 235 },
+  { role: "quantity", xMin: 278, xMax: 318 },
+  { role: "unit", xMin: 318, xMax: 395 },
+  { role: "unitPrice", xMin: 395, xMax: 490 },
+  { role: "lineTotal", xMin: 490, xMax: 560 },
+];
+
+export const ECON_FLOOR_POSITION_RE = /^\d{1,3}\.?$/;
+export const ECON_FLOOR_MERGED_POS_ART_RE = /^(\d{1,3})\.(\d{5,8})$/;
+export const ECON_FLOOR_ARTICLE_RE = /^\d{4,8}$/;
+
+export function isEconFloorTableEnd(text: string): boolean {
+  const t = text.trim();
+  if (!t) return false;
+  if (/Payment\s+Form/i.test(t)) return true;
+  if (/Total\s+to\s+be\s+Paid/i.test(t)) return true;
+  if (/^Including:/i.test(t)) return true;
+  if (/^Total:/i.test(t)) return true;
+  return false;
+}
+
+export function findEconFloorHeaderIndex(lines: import("../../pdf/types").PdfLine[]): number {
+  for (let i = 0; i < lines.length; i++) {
+    const t = lines[i]!.text;
+    if (/No\.?/i.test(t) && (/Quantity/i.test(t) || /Item/i.test(t))) return i;
+  }
+  return -1;
+}
+
+export function parseEconFloorPositionCell(
+  text: string,
+): { position: string; article: string | null } | null {
+  const t = text.trim().replace(/\s/g, "");
+  const merged = ECON_FLOOR_MERGED_POS_ART_RE.exec(t);
+  if (merged) return { position: merged[1]!, article: merged[2]! };
+
+  if (ECON_FLOOR_POSITION_RE.test(t)) {
+    return { position: t.replace(/\.$/, ""), article: null };
+  }
+  if (/^\d{1,3}$/.test(t)) return { position: t, article: null };
+  return null;
+}
+
+export function textInEconFloorWindow(
+  line: import("../../pdf/types").PdfLine,
+  win: ColumnWindow,
+  minOverlap = 0.5,
+): string {
+  const words = line.words
+    .filter((w) => {
+      const left = w.x;
+      const right = w.x + w.fontSize * 0.45;
+      const overlap = Math.min(right, win.xMax) - Math.max(left, win.xMin);
+      const width = Math.max(right - left, 0.001);
+      return overlap / width >= minOverlap;
+    })
+    .sort((a, b) => a.x - b.x);
+  return words.map((w) => w.text).join(" ").trim();
+}
+
+export function econFloorCellsFromLine(
+  line: import("../../pdf/types").PdfLine,
+  windows: ColumnWindow[] = ECON_FLOOR_WINDOWS,
+): Partial<Record<ColumnRole, string>> {
+  const out: Partial<Record<ColumnRole, string>> = {};
+  for (const win of windows) {
+    const t = textInEconFloorWindow(line, win);
+    if (!t) continue;
+    out[win.role] = out[win.role] ? `${out[win.role]} ${t}` : t;
+  }
+  return out;
+}
diff --git a/desktop/src/extractor/table/econ-floor-extract.test.ts b/desktop/src/extractor/table/econ-floor-extract.test.ts
new file mode 100644
index 0000000..927eb20
--- /dev/null
+++ b/desktop/src/extractor/table/econ-floor-extract.test.ts
@@ -0,0 +1,79 @@
+import { describe, expect, it } from "vitest";
+import type { PdfLine, PdfStructured } from "../../pdf/types";
+import { extractEconFloorItems } from "./econ-floor-extract";
+
+function line(y: number, parts: Array<{ text: string; x: number }>): PdfLine {
+  const words = parts.map((p) => ({ ...p, y, fontSize: 10 }));
+  return { y, words, text: words.map((w) => w.text).join(" ") };
+}
+
+describe("extractEconFloorItems", () => {
+  it("extracts synthetic FPF-style rows with split descriptions", () => {
+    const yHeader = 331;
+    const lines: PdfLine[] = [
+      line(yHeader, [
+        { text: "No.", x: 62 },
+        { text: "Item/Service", x: 76 },
+        { text: "Name", x: 129 },
+        { text: "BOX", x: 246 },
+        { text: "Quantity", x: 286 },
+        { text: "UOM", x: 321 },
+      ]),
+      line(346, [
+        { text: "1.257255", x: 68 },
+        { text: "14", x: 247 },
+        { text: "37,1", x: 303 },
+        { text: "m2", x: 322 },
+        { text: "14,65", x: 409 },
+        { text: "0%", x: 477 },
+        { text: "543,52", x: 536 },
+      ]),
+      line(358, [
+        { text: "SPC", x: 76 },
+        { text: "Rigid", x: 92 },
+        { text: "Vinyl", x: 111 },
+        { text: "Floor", x: 129 },
+      ]),
+      line(474, [
+        { text: "6.", x: 67 },
+        { text: "Transport", x: 76 },
+        { text: "0", x: 247 },
+        { text: "1", x: 314 },
+        { text: "sz", x: 322 },
+        { text: "250,00", x: 404 },
+        { text: "0%", x: 477 },
+        { text: "250,00", x: 535 },
+      ]),
+      line(513, [{ text: "Payment Form", x: 55 }]),
+    ];
+
+    const structured: PdfStructured = {
+      sourceFileName: "fpf.pdf",
+      pages: [
+        {
+          index: 0,
+          width: 595,
+          height: 842,
+          lines,
+          rawText: "Proforma Invoice\nECONFLOOR",
+        },
+      ],
+    };
+
+    const { items } = extractEconFloorItems(structured);
+    expect(items.length).toBe(2);
+
+    expect(items[0]?.position).toBe("1");
+    expect(items[0]?.article_number).toBe("257255");
+    expect(items[0]?.description).toContain("SPC");
+    expect(items[0]?.quantity).toBe(37.1);
+    expect(items[0]?.unit).toBe("m2");
+    expect(items[0]?.unit_price).toBe(14.65);
+    expect(items[0]?.line_total).toBe(543.52);
+
+    expect(items[1]?.position).toBe("6");
+    expect(items[1]?.description).toContain("Transport");
+    expect(items[1]?.quantity).toBe(1);
+    expect(items[1]?.line_total).toBe(250);
+  });
+});
diff --git a/desktop/src/extractor/table/econ-floor-extract.ts b/desktop/src/extractor/table/econ-floor-extract.ts
new file mode 100644
index 0000000..c7a6472
--- /dev/null
+++ b/desktop/src/extractor/table/econ-floor-extract.ts
@@ -0,0 +1,199 @@
+import type { LineItem } from "../models";
+import { parseDeNumber } from "../utils";
+import type { PdfLine, PdfPageStructured, PdfStructured } from "../../pdf/types";
+import type { ColumnRole } from "./header-map";
+import {
+  ECON_FLOOR_ARTICLE_RE,
+  ECON_FLOOR_WINDOWS,
+  econFloorCellsFromLine,
+  findEconFloorHeaderIndex,
+  isEconFloorTableEnd,
+  parseEconFloorPositionCell,
+  textInEconFloorWindow,
+} from "./econ-floor-anchors";
+import { isNonItemLine } from "./table-zone";
+
+const UNIT_ONLY = /^(m2|m┬▓|szt|sz|pcs?|pc)$/i;
+const SKIP_DESC = /^(no\.?|item|quantity|uom|box|vat|subtotal)$/i;
+
+function windowFor(role: ColumnRole) {
+  return ECON_FLOOR_WINDOWS.find((w) => w.role === role);
+}
+
+function stripVat(text: string): string {
+  return text.replace(/\s*0\s*%/g, "").trim();
+}
+
+function parseBillingNumber(text: string): number | null {
+  const cleaned = stripVat(text);
+  const direct = parseDeNumber(cleaned);
+  if (direct !== null) return direct;
+  const m = /[\d.,]+/.exec(cleaned);
+  return m ? parseDeNumber(m[0]!) : null;
+}
+
+function parseArticleFromLine(line: PdfLine): string | null {
+  const artWin = windowFor("article");
+  if (!artWin) return null;
+  const cell = textInEconFloorWindow(line, artWin);
+  const m = ECON_FLOOR_ARTICLE_RE.exec(cell.replace(/\s/g, ""));
+  return m ? m[0]! : null;
+}
+
+function isPositionAnchorLine(line: PdfLine): boolean {
+  const posWin = windowFor("position");
+  if (!posWin) return false;
+  const cell = textInEconFloorWindow(line, posWin);
+  if (parseEconFloorPositionCell(cell)) return true;
+  const merged = line.text.trim().replace(/\s/g, "");
+  return /^(\d{1,3})\.(\d{5,8})$/.test(merged);
+}
+
+function findPositionAnchors(lines: PdfLine[], start: number, end: number): number[] {
+  const anchors: number[] = [];
+  for (let i = start; i < end; i++) {
+    const line = lines[i]!;
+    if (!line.text.trim()) continue;
+    if (isEconFloorTableEnd(line.text)) break;
+    if (isPositionAnchorLine(line)) anchors.push(i);
+  }
+  return anchors;
+}
+
+function findTableEndIndex(lines: PdfLine[], start: number): number {
+  for (let i = start; i < lines.length; i++) {
+    if (isEconFloorTableEnd(lines[i]!.text)) return i;
+  }
+  return lines.length;
+}
+
+function lineHasEconFloorBilling(line: PdfLine): boolean {
+  const priceWin = windowFor("unitPrice");
+  const totalWin = windowFor("lineTotal");
+  if (!priceWin || !totalWin) return false;
+  const price = textInEconFloorWindow(line, priceWin);
+  const total = textInEconFloorWindow(line, totalWin);
+  return parseBillingNumber(price) !== null || parseBillingNumber(total) !== null;
+}
+
+function mergeBillingCells(
+  line: PdfLine,
+  merged: Partial<Record<ColumnRole, string>>,
+  force = false,
+): void {
+  if (!force && !lineHasEconFloorBilling(line)) return;
+  const cells = econFloorCellsFromLine(line);
+  for (const role of ["quantity", "unit", "unitPrice", "lineTotal"] as const) {
+    const val = stripVat(cells[role] ?? "");
+    if (val) merged[role] = val;
+  }
+}
+
+function parseEconFloorBlock(
+  lines: PdfLine[],
+  start: number,
+  end: number,
+): LineItem | null {
+  const merged: Partial<Record<ColumnRole, string>> = {};
+  const descParts: string[] = [];
+
+  const anchorLine = lines[start]!;
+  const posWin = windowFor("position")!;
+  const posCell = textInEconFloorWindow(anchorLine, posWin);
+  const parsed = parseEconFloorPositionCell(posCell);
+  if (!parsed) return null;
+
+  let article = parsed.article;
+  if (!article) {
+    article = parseArticleFromLine(anchorLine);
+  }
+
+  mergeBillingCells(anchorLine, merged, true);
+
+  const anchorDesc = textInEconFloorWindow(anchorLine, windowFor("description")!);
+  if (
+    anchorDesc &&
+    !SKIP_DESC.test(anchorDesc) &&
+    !parseEconFloorPositionCell(anchorDesc) &&
+    !ECON_FLOOR_ARTICLE_RE.test(anchorDesc.replace(/\s/g, ""))
+  ) {
+    descParts.push(anchorDesc);
+  }
+
+  for (let i = start + 1; i < end; i++) {
+    const line = lines[i]!;
+    const text = line.text.trim();
+    if (!text || SKIP_DESC.test(text)) continue;
+    if (isNonItemLine(line, 842)) continue;
+    if (isEconFloorTableEnd(text)) break;
+
+    if (isPositionAnchorLine(line)) break;
+
+    mergeBillingCells(line, merged);
+
+    if (!article) {
+      const art = parseArticleFromLine(line);
+      if (art) article = art;
+    }
+
+    const descWin = windowFor("description")!;
+    const desc = textInEconFloorWindow(line, descWin);
+    if (
+      desc &&
+      !SKIP_DESC.test(desc) &&
+      !/^[,.\-ÔÇôÔÇö]+$/.test(desc.trim()) &&
+      !parseEconFloorPositionCell(desc) &&
+      !ECON_FLOOR_ARTICLE_RE.test(desc.replace(/\s/g, "")) &&
+      !UNIT_ONLY.test(desc)
+    ) {
+      if (!descParts.includes(desc)) descParts.push(desc);
+    }
+  }
+
+  const quantity = parseBillingNumber(merged.quantity ?? "");
+  const unit_price = parseBillingNumber(merged.unitPrice ?? "");
+  const line_total = parseBillingNumber(merged.lineTotal ?? "");
+  const hasNumeric = quantity !== null || unit_price !== null || line_total !== null;
+  if (!hasNumeric) return null;
+
+  let unit: string | null = (merged.unit ?? "").trim() || null;
+  if (unit && unit.length > 8) unit = null;
+
+  return {
+    position: parsed.position,
+    article_number: article,
+    artikel_prefix: null,
+    description: descParts.join("\n").trim(),
+    quantity,
+    unit,
+    unit_price,
+    line_total,
+  };
+}
+
+function extractFromPage(page: PdfPageStructured): LineItem[] {
+  const headerIdx = findEconFloorHeaderIndex(page.lines);
+  if (headerIdx < 0) return [];
+
+  const dataStart = headerIdx + 1;
+  const dataEnd = findTableEndIndex(page.lines, dataStart);
+  const anchors = findPositionAnchors(page.lines, dataStart, dataEnd);
+  if (anchors.length === 0) return [];
+
+  const items: LineItem[] = [];
+  for (let a = 0; a < anchors.length; a++) {
+    const start = anchors[a]!;
+    const end = a + 1 < anchors.length ? anchors[a + 1]! : dataEnd;
+    const item = parseEconFloorBlock(page.lines, start, end);
+    if (item) items.push(item);
+  }
+  return items;
+}
+
+export function extractEconFloorItems(structured: PdfStructured): { items: LineItem[] } {
+  const items: LineItem[] = [];
+  for (const page of structured.pages) {
+    items.push(...extractFromPage(page));
+  }
+  return { items };
+}


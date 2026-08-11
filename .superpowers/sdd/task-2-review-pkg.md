# Review package Task 2
BASE: 5a9d053667ead24b4938d2ce3df33024e2695ee1
HEAD: b74b47bf1081a5e65384f7bdeb09fcf32edbb818

## Commits


## Stat
 desktop/src/pdf/ocr/lines-from-words.test.ts | 29 ++++++++++++++++++++
 desktop/src/pdf/ocr/lines-from-words.ts      | 40 ++++++++++++++++++++++++++++
 desktop/src/pdf/ocr/types.ts                 | 14 ++++++++++
 3 files changed, 83 insertions(+)


## Diff
diff --git a/desktop/src/pdf/ocr/lines-from-words.test.ts b/desktop/src/pdf/ocr/lines-from-words.test.ts
new file mode 100644
index 0000000..43d0990
--- /dev/null
+++ b/desktop/src/pdf/ocr/lines-from-words.test.ts
@@ -0,0 +1,29 @@
+import { describe, expect, it } from "vitest";
+import { linesFromPdfWords, pdfWordsFromOcrBoxes } from "./lines-from-words";
+
+describe("pdfWordsFromOcrBoxes", () => {
+  it("maps pixel boxes into PDF points using scale", () => {
+    const words = pdfWordsFromOcrBoxes(
+      [{ text: "Hello", x0: 100, y0: 40, x1: 180, y1: 60 }],
+      { pageIndex: 0, widthPt: 595, heightPt: 842, scale: 2 },
+    );
+    expect(words).toHaveLength(1);
+    expect(words[0]!.text).toBe("Hello");
+    expect(words[0]!.x).toBeCloseTo(50);
+    expect(words[0]!.y).toBeCloseTo(20);
+    expect(words[0]!.fontSize).toBeCloseTo(10);
+  });
+});
+
+describe("linesFromPdfWords", () => {
+  it("clusters words with similar y into one line left-to-right", () => {
+    const lines = linesFromPdfWords([
+      { text: "B", x: 80, y: 100.5, fontSize: 10 },
+      { text: "A", x: 10, y: 100, fontSize: 10 },
+      { text: "C", x: 10, y: 140, fontSize: 10 },
+    ]);
+    expect(lines).toHaveLength(2);
+    expect(lines[0]!.text).toBe("A B");
+    expect(lines[1]!.text).toBe("C");
+  });
+});
diff --git a/desktop/src/pdf/ocr/lines-from-words.ts b/desktop/src/pdf/ocr/lines-from-words.ts
new file mode 100644
index 0000000..2bf2a5f
--- /dev/null
+++ b/desktop/src/pdf/ocr/lines-from-words.ts
@@ -0,0 +1,40 @@
+import type { PdfLine, PdfWord } from "../types";
+import type { OcrWordBox, PageRenderMeta } from "./types";
+
+export type { OcrWordBox, PageRenderMeta } from "./types";
+
+export function pdfWordsFromOcrBoxes(
+  words: OcrWordBox[],
+  meta: PageRenderMeta,
+): PdfWord[] {
+  const { scale } = meta;
+  return words
+    .filter((w) => w.text.trim().length > 0)
+    .map((w) => ({
+      text: w.text,
+      x: w.x0 / scale,
+      y: w.y0 / scale,
+      fontSize: Math.max(6, (w.y1 - w.y0) / scale),
+    }));
+}
+
+export function linesFromPdfWords(words: PdfWord[], yTol = 3): PdfLine[] {
+  if (words.length === 0) return [];
+
+  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
+  const lines: PdfLine[] = [];
+
+  for (const w of sorted) {
+    const last = lines[lines.length - 1];
+    if (last && Math.abs(last.y - w.y) <= yTol) {
+      last.words.push(w);
+      last.words.sort((a, b) => a.x - b.x);
+      last.text = last.words.map((x) => x.text).join(" ");
+      last.y = (last.y * (last.words.length - 1) + w.y) / last.words.length;
+    } else {
+      lines.push({ y: w.y, words: [w], text: w.text });
+    }
+  }
+
+  return lines;
+}
diff --git a/desktop/src/pdf/ocr/types.ts b/desktop/src/pdf/ocr/types.ts
new file mode 100644
index 0000000..086f00a
--- /dev/null
+++ b/desktop/src/pdf/ocr/types.ts
@@ -0,0 +1,14 @@
+export type OcrWordBox = {
+  text: string;
+  x0: number;
+  y0: number;
+  x1: number;
+  y1: number;
+};
+
+export type PageRenderMeta = {
+  pageIndex: number;
+  widthPt: number;
+  heightPt: number;
+  scale: number;
+};


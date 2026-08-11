# Review package Task 4 re-review
BASE: a11167e76d3c681031e7597b416a650009278c25
HEAD: 95e84ef8d190010a84d9d9701f252bdcf2eef883
## Commits

## Stat
 desktop/src/pdf/ocr/index.ts            |  1 +
 desktop/src/pdf/ocr/ocr-structured.ts   | 37 ++++++++++++++++
 desktop/src/pdf/ocr/render-pages.ts     | 76 +++++++++++++++++++++------------
 desktop/src/pdf/ocr/tesseract-worker.ts | 45 +++++++++++++++++++
 4 files changed, 131 insertions(+), 28 deletions(-)

## Diff
diff --git a/desktop/src/pdf/ocr/index.ts b/desktop/src/pdf/ocr/index.ts
new file mode 100644
index 0000000..63babfd
--- /dev/null
+++ b/desktop/src/pdf/ocr/index.ts
@@ -0,0 +1 @@
+´╗┐export { ocrStructuredFromPdf, ocrStructuredFromPdfBytes } from "./ocr-structured";
diff --git a/desktop/src/pdf/ocr/ocr-structured.ts b/desktop/src/pdf/ocr/ocr-structured.ts
new file mode 100644
index 0000000..8598c66
--- /dev/null
+++ b/desktop/src/pdf/ocr/ocr-structured.ts
@@ -0,0 +1,37 @@
+import type { PdfStructured, PdfPageStructured } from "../types";
+import { linesFromPdfWords, pdfWordsFromOcrBoxes } from "./lines-from-words";
+import { forEachRenderedPdfPage } from "./render-pages";
+import { recognizePng } from "./tesseract-worker";
+
+async function ocrStructuredFromRendered(
+  sourceFileName: string,
+  file: File,
+): Promise<PdfStructured> {
+  const pages: PdfPageStructured[] = [];
+  await forEachRenderedPdfPage(file, 144, async ({ png, meta }) => {
+    const boxes = await recognizePng(png);
+    const words = pdfWordsFromOcrBoxes(boxes, meta);
+    const lines = linesFromPdfWords(words);
+    const rawText = lines.map((l) => l.text).join("\n");
+    pages.push({
+      index: meta.pageIndex,
+      width: meta.widthPt,
+      height: meta.heightPt,
+      lines,
+      rawText,
+    });
+  });
+  return { sourceFileName, pages };
+}
+
+export async function ocrStructuredFromPdf(file: File): Promise<PdfStructured> {
+  return ocrStructuredFromRendered(file.name, file);
+}
+
+export async function ocrStructuredFromPdfBytes(
+  pdfBytes: Uint8Array,
+  sourceFileName: string,
+): Promise<PdfStructured> {
+  const file = new File([pdfBytes], sourceFileName, { type: "application/pdf" });
+  return ocrStructuredFromRendered(sourceFileName, file);
+}
diff --git a/desktop/src/pdf/ocr/render-pages.ts b/desktop/src/pdf/ocr/render-pages.ts
index b1654e2..248d4b1 100644
--- a/desktop/src/pdf/ocr/render-pages.ts
+++ b/desktop/src/pdf/ocr/render-pages.ts
@@ -1,45 +1,65 @@
 import { getMupdf } from "../mupdf-loader";
 import type { PageRenderMeta } from "./types";
 
 export type RenderedPage = { png: Uint8Array; meta: PageRenderMeta };
 
-export async function renderPdfPages(
+function renderPageAtIndex(
+  mupdf: Awaited<ReturnType<typeof getMupdf>>,
+  doc: ReturnType<Awaited<ReturnType<typeof getMupdf>>["Document"]["openDocument"]>,
+  pageIndex: number,
+  scale: number,
+): RenderedPage {
+  const page = doc.loadPage(pageIndex);
+  try {
+    const bounds = page.getBounds();
+    const widthPt = bounds[2] - bounds[0];
+    const heightPt = bounds[3] - bounds[1];
+    const pixmap = page.toPixmap(
+      mupdf.Matrix.scale(scale, scale),
+      mupdf.ColorSpace.DeviceRGB,
+      false,
+      true,
+    );
+    try {
+      const png = pixmap.asPNG();
+      return {
+        png: png instanceof Uint8Array ? png : new Uint8Array(png),
+        meta: { pageIndex, widthPt, heightPt, scale },
+      };
+    } finally {
+      pixmap.destroy();
+    }
+  } finally {
+    page.destroy();
+  }
+}
+
+export async function forEachRenderedPdfPage(
   file: File,
-  dpi = 144,
-): Promise<RenderedPage[]> {
+  dpi: number,
+  onPage: (page: RenderedPage) => Promise<void>,
+): Promise<void> {
   const mupdf = await getMupdf();
   const scale = dpi / 72;
   const buf = await file.arrayBuffer();
   const doc = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf");
   try {
-    const out: RenderedPage[] = [];
     for (let i = 0; i < doc.countPages(); i++) {
-      const page = doc.loadPage(i);
-      try {
-        const bounds = page.getBounds();
-        const widthPt = bounds[2] - bounds[0];
-        const heightPt = bounds[3] - bounds[1];
-        const pixmap = page.toPixmap(
-          mupdf.Matrix.scale(scale, scale),
-          mupdf.ColorSpace.DeviceRGB,
-          false,
-          true,
-        );
-        try {
-          const png = pixmap.asPNG();
-          out.push({
-            png: png instanceof Uint8Array ? png : new Uint8Array(png),
-            meta: { pageIndex: i, widthPt, heightPt, scale },
-          });
-        } finally {
-          pixmap.destroy();
-        }
-      } finally {
-        page.destroy();
-      }
+      const rendered = renderPageAtIndex(mupdf, doc, i, scale);
+      await onPage(rendered);
     }
-    return out;
   } finally {
     doc.destroy();
   }
 }
+
+export async function renderPdfPages(
+  file: File,
+  dpi = 144,
+): Promise<RenderedPage[]> {
+  const out: RenderedPage[] = [];
+  await forEachRenderedPdfPage(file, dpi, async (page) => {
+    out.push(page);
+  });
+  return out;
+}
diff --git a/desktop/src/pdf/ocr/tesseract-worker.ts b/desktop/src/pdf/ocr/tesseract-worker.ts
new file mode 100644
index 0000000..2ed2d9b
--- /dev/null
+++ b/desktop/src/pdf/ocr/tesseract-worker.ts
@@ -0,0 +1,45 @@
+´╗┐import { createWorker, type Worker } from "tesseract.js";
+import type { OcrWordBox } from "./types";
+
+let workerPromise: Promise<Worker> | null = null;
+
+async function createOcrWorker(): Promise<Worker> {
+  if (typeof window !== "undefined") {
+    return createWorker("deu+eng", 1, {
+      workerPath: "/tesseract/worker.min.js",
+      corePath: "/tesseract/",
+      langPath: "/tesseract",
+      gzip: false,
+    });
+  }
+  const { fileURLToPath } = await import("node:url");
+  const langPath = fileURLToPath(
+    new URL("../../../public/tesseract", import.meta.url),
+  );
+  return createWorker("deu+eng", 1, { langPath, gzip: false });
+}
+
+export async function getOcrWorker(): Promise<Worker> {
+  if (!workerPromise) {
+    workerPromise = createOcrWorker();
+  }
+  return workerPromise;
+}
+
+export async function recognizePng(png: Uint8Array): Promise<OcrWordBox[]> {
+  const worker = await getOcrWorker();
+  const image =
+    typeof window !== "undefined"
+      ? new Blob([png], { type: "image/png" })
+      : Buffer.from(png);
+  const result = await worker.recognize(image);
+  return (result.data.words ?? [])
+    .filter((w) => w.text?.trim())
+    .map((w) => ({
+      text: w.text.trim(),
+      x0: w.bbox.x0,
+      y0: w.bbox.y0,
+      x1: w.bbox.x1,
+      y1: w.bbox.y1,
+    }));
+}


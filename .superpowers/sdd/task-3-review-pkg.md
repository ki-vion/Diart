# Review package Task 3
BASE: b74b47bf1081a5e65384f7bdeb09fcf32edbb818
HEAD: a11167e76d3c681031e7597b416a650009278c25
## Commits

## Stat
 desktop/src/pdf/ocr/render-pages.ts | 45 +++++++++++++++++++++++++++++++++++++
 1 file changed, 45 insertions(+)

## Diff
diff --git a/desktop/src/pdf/ocr/render-pages.ts b/desktop/src/pdf/ocr/render-pages.ts
new file mode 100644
index 0000000..b1654e2
--- /dev/null
+++ b/desktop/src/pdf/ocr/render-pages.ts
@@ -0,0 +1,45 @@
+import { getMupdf } from "../mupdf-loader";
+import type { PageRenderMeta } from "./types";
+
+export type RenderedPage = { png: Uint8Array; meta: PageRenderMeta };
+
+export async function renderPdfPages(
+  file: File,
+  dpi = 144,
+): Promise<RenderedPage[]> {
+  const mupdf = await getMupdf();
+  const scale = dpi / 72;
+  const buf = await file.arrayBuffer();
+  const doc = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf");
+  try {
+    const out: RenderedPage[] = [];
+    for (let i = 0; i < doc.countPages(); i++) {
+      const page = doc.loadPage(i);
+      try {
+        const bounds = page.getBounds();
+        const widthPt = bounds[2] - bounds[0];
+        const heightPt = bounds[3] - bounds[1];
+        const pixmap = page.toPixmap(
+          mupdf.Matrix.scale(scale, scale),
+          mupdf.ColorSpace.DeviceRGB,
+          false,
+          true,
+        );
+        try {
+          const png = pixmap.asPNG();
+          out.push({
+            png: png instanceof Uint8Array ? png : new Uint8Array(png),
+            meta: { pageIndex: i, widthPt, heightPt, scale },
+          });
+        } finally {
+          pixmap.destroy();
+        }
+      } finally {
+        page.destroy();
+      }
+    }
+    return out;
+  } finally {
+    doc.destroy();
+  }
+}


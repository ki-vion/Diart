# Review package Task 5
BASE: 95e84ef8d190010a84d9d9701f252bdcf2eef883
HEAD: 3443cf6ba18116083afe5165788efcdaba3aca8a
## Commits

## Stat
 desktop/src/App.vue                 |  10 +++-
 desktop/src/lib/convert.web.test.ts | 105 ++++++++++++++++++++++++++++++++++++
 desktop/src/lib/convert.web.ts      |  17 ++++--
 3 files changed, 126 insertions(+), 6 deletions(-)

## Diff
diff --git a/desktop/src/App.vue b/desktop/src/App.vue
index d29b539..9cda462 100644
--- a/desktop/src/App.vue
+++ b/desktop/src/App.vue
@@ -5,16 +5,17 @@ import {
   type ConvertResponse,
   type PreviewRow,
 } from "./lib/convert";
 import { downloadBlob } from "./lib/download";
 import { formatEuroDe, formatQuantityDe } from "./export/format-money";
 
 const aufschlagPercent = ref(20);
 const loading = ref(false);
+const status = ref("");
 const result = ref<ConvertResponse | null>(null);
 const error = ref("");
 const pdfInput = ref<HTMLInputElement | null>(null);
 
 const previewColumns = [
   "Artikel",
   "Menge",
   "Einheit",
@@ -52,18 +53,23 @@ async function onPdfSelected(event: Event) {
   const input = event.target as HTMLInputElement;
   const file = input.files?.item(0);
   input.value = "";
   if (!file) return;
 
   loading.value = true;
   error.value = "";
   result.value = null;
+  status.value = "Wird konvertiertÔÇª";
   try {
-    const res = await convertPdfFile(file, aufschlagPercent.value);
+    const res = await convertPdfFile(file, aufschlagPercent.value, {
+      onStatus: (msg) => {
+        status.value = msg;
+      },
+    });
     result.value = res;
     if (!res.ok) {
       error.value = res.error ?? "Konvertierung fehlgeschlagen";
     }
   } catch (e) {
     error.value = e instanceof Error ? e.message : String(e);
   } finally {
     loading.value = false;
@@ -118,17 +124,17 @@ function cell(row: PreviewRow, col: (typeof previewColumns)[number]) {
           ref="pdfInput"
           type="file"
           accept="application/pdf,.pdf"
           class="file-input"
           :disabled="loading"
           @change="onPdfSelected"
         />
         <button type="button" class="primary" :disabled="loading" @click="openFilePicker">
-          {{ loading ? "Wird konvertiertÔÇª" : "PDF ausw├ñhlen & konvertieren" }}
+          {{ loading ? status || "Wird konvertiertÔÇª" : "PDF ausw├ñhlen & konvertieren" }}
         </button>
       </div>
     </section>
 
     <p v-if="error" class="error">{{ error }}</p>
 
     <section v-if="result?.ok" class="card success">
       <p>{{ result.message }}</p>
diff --git a/desktop/src/lib/convert.web.test.ts b/desktop/src/lib/convert.web.test.ts
new file mode 100644
index 0000000..cd9cec8
--- /dev/null
+++ b/desktop/src/lib/convert.web.test.ts
@@ -0,0 +1,105 @@
+import { beforeEach, describe, expect, it, vi } from "vitest";
+import type { ExtractionResult } from "../extractor/models";
+import type { PdfStructured } from "../pdf/types";
+
+const mockExtractPdfStructured = vi.fn();
+const mockOcrStructuredFromPdf = vi.fn();
+const mockDetectProfile = vi.fn();
+const mockRunExtraction = vi.fn();
+const mockBuildExcelBuffer = vi.fn();
+
+vi.mock("../pdf/structured", () => ({
+  extractPdfStructured: (...args: unknown[]) => mockExtractPdfStructured(...args),
+}));
+
+vi.mock("../pdf/ocr", () => ({
+  ocrStructuredFromPdf: (...args: unknown[]) => mockOcrStructuredFromPdf(...args),
+}));
+
+vi.mock("../extractor", () => ({
+  detectProfile: (...args: unknown[]) => mockDetectProfile(...args),
+  runExtraction: (...args: unknown[]) => mockRunExtraction(...args),
+}));
+
+vi.mock("../export/excel", () => ({
+  buildExcelBuffer: (...args: unknown[]) => mockBuildExcelBuffer(...args),
+}));
+
+import { convertPdfFile } from "./convert.web";
+
+function makeStructured(rawText: string): PdfStructured {
+  return {
+    sourceFileName: "test.pdf",
+    pages: [{ index: 0, width: 100, height: 100, lines: [], rawText }],
+  };
+}
+
+function makeExtraction(layoutId: string): ExtractionResult {
+  return {
+    layout_id: layoutId,
+    source_pdf: "test.pdf",
+    items: [],
+  };
+}
+
+describe("convertPdfFile OCR gate", () => {
+  beforeEach(() => {
+    vi.clearAllMocks();
+    mockBuildExcelBuffer.mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5]));
+  });
+
+  it("runs OCR when initial profile is generic", async () => {
+    const rawStructured = makeStructured("unknown");
+    const ocrStructured = makeStructured("ocr result");
+    mockExtractPdfStructured.mockResolvedValue(rawStructured);
+    mockDetectProfile
+      .mockReturnValueOnce("generic")
+      .mockReturnValueOnce("generic");
+    mockOcrStructuredFromPdf.mockResolvedValue(ocrStructured);
+    mockRunExtraction.mockReturnValue(makeExtraction("generic-table"));
+
+    const file = new File(["pdf"], "test.pdf", { type: "application/pdf" });
+    const res = await convertPdfFile(file, 20);
+
+    expect(mockOcrStructuredFromPdf).toHaveBeenCalledWith(file);
+    expect(mockRunExtraction).toHaveBeenCalledWith(ocrStructured);
+    expect(res.ok).toBe(true);
+    expect(res.extraction_mode).toBe("table");
+  });
+
+  it("skips OCR when profile is known (Mahler)", async () => {
+    const structured = makeStructured("Bauwaren Mahler GmbH");
+    mockExtractPdfStructured.mockResolvedValue(structured);
+    mockDetectProfile.mockReturnValue("Bauwaren Mahler");
+    mockRunExtraction.mockReturnValue(makeExtraction("Bauwaren Mahler"));
+
+    const file = new File(["pdf"], "mahler.pdf", { type: "application/pdf" });
+    const res = await convertPdfFile(file, 20);
+
+    expect(mockOcrStructuredFromPdf).not.toHaveBeenCalled();
+    expect(mockRunExtraction).toHaveBeenCalledWith(structured);
+    expect(res.ok).toBe(true);
+    expect(res.extraction_mode).toBe("layout");
+  });
+
+  it("reports status messages via onStatus", async () => {
+    const structured = makeStructured("unknown");
+    const ocrStructured = makeStructured("ocr result");
+    mockExtractPdfStructured.mockResolvedValue(structured);
+    mockDetectProfile
+      .mockReturnValueOnce("generic")
+      .mockReturnValueOnce("generic");
+    mockOcrStructuredFromPdf.mockResolvedValue(ocrStructured);
+    mockRunExtraction.mockReturnValue(makeExtraction("generic-table"));
+
+    const statuses: string[] = [];
+    const file = new File(["pdf"], "test.pdf", { type: "application/pdf" });
+    await convertPdfFile(file, 20, {
+      onStatus: (msg) => statuses.push(msg),
+    });
+
+    expect(statuses).toContain("PDF wird gelesenÔÇª");
+    expect(statuses).toContain("Unbekanntes Layout ÔÇö OCR l├ñuftÔÇª");
+    expect(statuses).toContain("Positionen werden extrahiertÔÇª");
+  });
+});
diff --git a/desktop/src/lib/convert.web.ts b/desktop/src/lib/convert.web.ts
index 6d7a4ff..76084d2 100644
--- a/desktop/src/lib/convert.web.ts
+++ b/desktop/src/lib/convert.web.ts
@@ -102,28 +102,37 @@ function toPreviewRows(
       Aufschlag: aufschlag,
     };
   });
 }
 
 export async function convertPdfFile(
   file: File,
   aufschlagPercent: number,
+  options?: { onStatus?: (msg: string) => void },
 ): Promise<ConvertResponse> {
   const aufschlag = aufschlagPercent / 100;
+  const { onStatus } = options ?? {};
 
   try {
     const { extractPdfStructured } = await import("../pdf/structured");
-    const { runExtraction } = await import("../extractor");
     const { buildExcelBuffer } = await import("../export/excel");
 
+    onStatus?.("PDF wird gelesenÔÇª");
     const structured = await extractPdfStructured(file);
-    const { detectProfile } = await import("../extractor");
-    const extraction = runExtraction(structured);
-    const profile = detectProfile(structured);
+    const { detectProfile, runExtraction } = await import("../extractor");
+    let forExtract = structured;
+    if (detectProfile(structured) === "generic") {
+      onStatus?.("Unbekanntes Layout ÔÇö OCR l├ñuftÔÇª");
+      const { ocrStructuredFromPdf } = await import("../pdf/ocr");
+      forExtract = await ocrStructuredFromPdf(file);
+    }
+    onStatus?.("Positionen werden extrahiertÔÇª");
+    const extraction = runExtraction(forExtract);
+    const profile = detectProfile(forExtract);
     const extraction_mode = profile === "generic" ? "table" : "layout";
 
     const xlsxBytes = await buildExcelBuffer(extraction, { aufschlag });
     const xlsxBlob = new Blob([toArrayBuffer(xlsxBytes)], {
       type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
     });
 
     const baseName = file.name.replace(/\.pdf$/i, "");


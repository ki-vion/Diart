# Review package Task 1 (re-review)
BASE: 1b802aaebcf510b438c1f762a3e0e946319d1dcb
HEAD: 5a9d053667ead24b4938d2ce3df33024e2695ee1

## Commits


## Stat
 desktop/package-lock.json                          | 122 +++++++++
 desktop/package.json                               |   4 +-
 desktop/public/tesseract/deu.traineddata           | Bin 0 -> 15437534 bytes
 desktop/public/tesseract/eng.traineddata           | Bin 0 -> 23466654 bytes
 desktop/public/tesseract/tesseract-core-lstm.wasm  | Bin 0 -> 2859424 bytes
 .../public/tesseract/tesseract-core-lstm.wasm.js   | 282 +++++++++++++++++++++
 .../public/tesseract/tesseract-core-simd-lstm.wasm | Bin 0 -> 2859709 bytes
 .../tesseract/tesseract-core-simd-lstm.wasm.js     | 282 +++++++++++++++++++++
 desktop/public/tesseract/tesseract-core-simd.wasm  | Bin 0 -> 3457317 bytes
 .../public/tesseract/tesseract-core-simd.wasm.js   | 281 ++++++++++++++++++++
 desktop/public/tesseract/tesseract-core.wasm       | Bin 0 -> 3457035 bytes
 desktop/public/tesseract/tesseract-core.wasm.js    | 281 ++++++++++++++++++++
 desktop/public/tesseract/worker.min.js             |   3 +
 desktop/scripts/copy-tesseract-assets.mjs          |  75 ++++++
 desktop/vite.config.ts                             |   5 +-
 15 files changed, 1332 insertions(+), 3 deletions(-)


## Diff (source only)
diff --git a/desktop/package.json b/desktop/package.json
index eacffd3..674e29b 100644
--- a/desktop/package.json
+++ b/desktop/package.json
@@ -4,25 +4,27 @@
   "version": "0.1.0",
   "type": "module",
   "scripts": {
     "dev": "vite",
     "build": "vue-tsc --noEmit && vite build",
     "preview": "vite preview",
     "test": "vitest",
     "test:run": "vitest run",
     "explore:mupdf": "tsx scripts/explore-mupdf.ts",
     "explore:blocks": "tsx scripts/explore-blocks.ts",
-    "smoke:extract": "tsx scripts/smoke-table-extract.ts"
+    "smoke:extract": "tsx scripts/smoke-table-extract.ts",
+    "postinstall": "node scripts/copy-tesseract-assets.mjs"
   },
   "dependencies": {
     "exceljs": "^3.4.0",
     "mupdf": "^1.27.0",
+    "tesseract.js": "^5.1.1",
     "vue": "^3.5.13"
   },
   "overrides": {
     "uuid": "^11.1.1"
   },
   "devDependencies": {
     "@vitejs/plugin-vue": "^5.2.1",
     "@vitest/ui": "^4.1.7",
     "happy-dom": "^20.9.0",
     "typescript": "~5.6.2",
diff --git a/desktop/scripts/copy-tesseract-assets.mjs b/desktop/scripts/copy-tesseract-assets.mjs
new file mode 100644
index 0000000..97c99b4
--- /dev/null
+++ b/desktop/scripts/copy-tesseract-assets.mjs
@@ -0,0 +1,75 @@
+import fs from "fs";
+import path from "path";
+import { fileURLToPath } from "url";
+import { gunzipSync } from "zlib";
+
+const __dirname = path.dirname(fileURLToPath(import.meta.url));
+const desktopRoot = path.join(__dirname, "..");
+const outDir = path.join(desktopRoot, "public", "tesseract");
+const tesseractPkg = path.join(desktopRoot, "node_modules", "tesseract.js");
+const corePkg = path.join(desktopRoot, "node_modules", "tesseract.js-core");
+
+const CORE_WASM_JS = [
+  "tesseract-core.wasm.js",
+  "tesseract-core-simd.wasm.js",
+  "tesseract-core-lstm.wasm.js",
+  "tesseract-core-simd-lstm.wasm.js",
+];
+
+const LANGS = ["eng", "deu"];
+const LANG_DATA_BASE = "https://cdn.jsdelivr.net/npm/@tesseract.js-data";
+
+function copyFile(src, dest) {
+  fs.mkdirSync(path.dirname(dest), { recursive: true });
+  fs.copyFileSync(src, dest);
+}
+
+function copyIfExists(src, dest) {
+  if (!fs.existsSync(src)) {
+    throw new Error(`Missing tesseract asset: ${src}`);
+  }
+  copyFile(src, dest);
+}
+
+async function downloadTraineddata(lang) {
+  const url = `${LANG_DATA_BASE}/${lang}/4.0.0/${lang}.traineddata.gz`;
+  const res = await fetch(url);
+  if (!res.ok) {
+    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
+  }
+  const gz = Buffer.from(await res.arrayBuffer());
+  return gunzipSync(gz);
+}
+
+async function main() {
+  fs.mkdirSync(outDir, { recursive: true });
+
+  copyIfExists(
+    path.join(tesseractPkg, "dist", "worker.min.js"),
+    path.join(outDir, "worker.min.js"),
+  );
+
+  for (const name of CORE_WASM_JS) {
+    copyIfExists(path.join(corePkg, name), path.join(outDir, name));
+    const wasmName = name.replace(/\.js$/, "");
+    copyIfExists(path.join(corePkg, wasmName), path.join(outDir, wasmName));
+  }
+
+  for (const lang of LANGS) {
+    const dest = path.join(outDir, `${lang}.traineddata`);
+    if (fs.existsSync(dest)) {
+      console.log(`skip ${lang}.traineddata (already present)`);
+      continue;
+    }
+    console.log(`fetch ${lang}.traineddataÔÇª`);
+    const data = await downloadTraineddata(lang);
+    fs.writeFileSync(dest, data);
+  }
+
+  console.log(`Tesseract assets ready in ${outDir}`);
+}
+
+main().catch((err) => {
+  console.error(err);
+  process.exit(1);
+});
diff --git a/desktop/vite.config.ts b/desktop/vite.config.ts
index 00dfe18..58ce309 100644
--- a/desktop/vite.config.ts
+++ b/desktop/vite.config.ts
@@ -15,30 +15,31 @@ export default defineConfig({
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
-        globPatterns: ["**/*.{js,css,html,wasm,png,svg,ico,webmanifest}"],
-        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
+        globPatterns: ["**/*.{js,css,html,wasm,png,svg,ico,webmanifest,traineddata}"],
+        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
       },
     }),
   ],
   // MuPDF.js uses top-level await; default Vite/esbuild targets (es2020) reject it in dev.
   esbuild: {
     target: "esnext",
   },
   assetsInclude: ["**/*.wasm"],
   optimizeDeps: {
     exclude: ["mupdf"],
     esbuildOptions: {
       target: "esnext",
     },
   },
   build: {
     target: "esnext",
   },
 });
+

## public/tesseract listing

deu.traineddata 15437534
eng.traineddata 23466654
tesseract-core-lstm.wasm 2859424
tesseract-core-lstm.wasm.js 3938277
tesseract-core-simd-lstm.wasm 2859709
tesseract-core-simd-lstm.wasm.js 3938657
tesseract-core-simd.wasm 3457317
tesseract-core-simd.wasm.js 4735153
tesseract-core.wasm 3457035
tesseract-core.wasm.js 4734777
worker.min.js 123724

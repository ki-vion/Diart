import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { gunzipSync } from "zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, "..");
const outDir = path.join(desktopRoot, "public", "tesseract");
const tesseractPkg = path.join(desktopRoot, "node_modules", "tesseract.js");
const corePkg = path.join(desktopRoot, "node_modules", "tesseract.js-core");

const CORE_WASM_JS = [
  "tesseract-core.wasm.js",
  "tesseract-core-simd.wasm.js",
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js",
];

const LANGS = ["eng", "deu"];
const LANG_DATA_BASE = "https://cdn.jsdelivr.net/npm/@tesseract.js-data";

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing tesseract asset: ${src}`);
  }
  copyFile(src, dest);
}

async function downloadTraineddata(lang) {
  const url = `${LANG_DATA_BASE}/${lang}/4.0.0/${lang}.traineddata.gz`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const gz = Buffer.from(await res.arrayBuffer());
  return gunzipSync(gz);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  copyIfExists(
    path.join(tesseractPkg, "dist", "worker.min.js"),
    path.join(outDir, "worker.min.js"),
  );

  for (const name of CORE_WASM_JS) {
    copyIfExists(path.join(corePkg, name), path.join(outDir, name));
    const wasmName = name.replace(/\.js$/, "");
    copyIfExists(path.join(corePkg, wasmName), path.join(outDir, wasmName));
  }

  for (const lang of LANGS) {
    const dest = path.join(outDir, `${lang}.traineddata`);
    if (fs.existsSync(dest)) {
      console.log(`skip ${lang}.traineddata (already present)`);
      continue;
    }
    console.log(`fetch ${lang}.traineddata…`);
    const data = await downloadTraineddata(lang);
    fs.writeFileSync(dest, data);
  }

  console.log(`Tesseract assets ready in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

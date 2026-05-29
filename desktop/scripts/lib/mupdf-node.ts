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

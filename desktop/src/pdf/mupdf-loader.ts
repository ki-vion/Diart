type MupdfModule = typeof import("mupdf").default;

let mupdfPromise: Promise<MupdfModule> | null = null;

async function resolveWasmPath(): Promise<string> {
  if (typeof window === "undefined") {
    const { fileURLToPath } = await import("node:url");
    const { join, dirname } = await import("node:path");
    return join(
      dirname(fileURLToPath(import.meta.url)),
      "../../node_modules/mupdf/dist/mupdf-wasm.wasm",
    );
  }
  const { default: wasmUrl } = await import(
    "../../node_modules/mupdf/dist/mupdf-wasm.wasm?url"
  );
  return wasmUrl;
}

/** MuPDF must be loaded after setting locateFile — otherwise Vite serves HTML for the .wasm path. */
export async function getMupdf(): Promise<MupdfModule> {
  if (!mupdfPromise) {
    mupdfPromise = (async () => {
      const wasmPath = await resolveWasmPath();
      globalThis.$libmupdf_wasm_Module = {
        locateFile: () => wasmPath,
      };
      const mod = await import("mupdf");
      return mod.default;
    })();
  }
  return mupdfPromise;
}

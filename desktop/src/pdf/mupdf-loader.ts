import wasmUrl from "../../node_modules/mupdf/dist/mupdf-wasm.wasm?url";

type MupdfModule = typeof import("mupdf").default;

let mupdfPromise: Promise<MupdfModule> | null = null;

/** MuPDF must be loaded after setting locateFile — otherwise Vite serves HTML for the .wasm path. */
export async function getMupdf(): Promise<MupdfModule> {
  if (!mupdfPromise) {
    mupdfPromise = (async () => {
      globalThis.$libmupdf_wasm_Module = {
        locateFile: () => wasmUrl,
      };
      const mod = await import("mupdf");
      return mod.default;
    })();
  }
  return mupdfPromise;
}

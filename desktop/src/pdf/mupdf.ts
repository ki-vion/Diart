// Relative path: mupdf package.json does not export the .wasm subpath.
import wasmUrl from "../../node_modules/mupdf/dist/mupdf-wasm.wasm?url";
import type { PdfText } from "./types";

type MupdfModule = typeof import("mupdf").default;

let mupdfPromise: Promise<MupdfModule> | null = null;

/** MuPDF must be loaded after setting locateFile — otherwise Vite serves HTML for the .wasm path. */
async function getMupdf(): Promise<MupdfModule> {
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

function normalizeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export async function extractPdfLines(file: File): Promise<PdfText> {
  const mupdf = await getMupdf();
  const buf = await file.arrayBuffer();
  const doc = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf");
  try {
    const pageCount = doc.countPages();
    const pages: PdfText["pages"] = [];

    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      try {
        const text = page.toStructuredText().asText();
        pages.push({ index: i, lines: normalizeLines(text) });
      } finally {
        page.destroy();
      }
    }

    return { sourceFileName: file.name, pages };
  } finally {
    doc.destroy();
  }
}

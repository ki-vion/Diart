import { getMupdf } from "./mupdf-loader";
import type { PdfText } from "./types";

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

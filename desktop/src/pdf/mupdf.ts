import mupdf from "mupdf";
import type { PdfText } from "./types";

function normalizeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export async function extractPdfLines(file: File): Promise<PdfText> {
  const buf = await file.arrayBuffer();
  const doc = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf");
  try {
    const pageCount = doc.countPages();
    const pages: PdfText["pages"] = [];

    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      try {
        // MuPDF exposes rich text extraction via StructuredText.
        // `.asText()` yields plain text close to Python `get_text().splitlines()`.
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


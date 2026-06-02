import { getMupdf } from "./mupdf-loader";
import { linesFromStructuredText } from "./structured-lines";
import type { PdfStructured } from "./types";

export async function extractPdfStructured(file: File): Promise<PdfStructured> {
  const mupdf = await getMupdf();
  const buf = await file.arrayBuffer();
  const doc = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf");
  try {
    const pages = [];
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i);
      try {
        const bounds = page.getBounds();
        const stext = page.toStructuredText("preserve-spans");
        const rawText = stext.asText();
        pages.push({
          index: i,
          width: bounds[2] - bounds[0],
          height: bounds[3] - bounds[1],
          lines: linesFromStructuredText(stext),
          rawText,
        });
        stext.destroy();
      } finally {
        page.destroy();
      }
    }
    return { sourceFileName: file.name, pages };
  } finally {
    doc.destroy();
  }
}

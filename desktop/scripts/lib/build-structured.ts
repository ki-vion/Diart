import fs from "node:fs";
import type { loadMupdf } from "./mupdf-node.js";
import { linesFromStructuredText } from "../../src/pdf/structured-lines.js";
import type { PdfStructured } from "../../src/pdf/types.js";

export function buildStructuredFromPdf(
  mupdf: Awaited<ReturnType<typeof loadMupdf>>,
  pdfPath: string,
): PdfStructured {
  const buf = fs.readFileSync(pdfPath);
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
    return { sourceFileName: pdfPath.split(/[/\\]/).pop(), pages };
  } finally {
    doc.destroy();
  }
}

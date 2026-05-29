import fs from "node:fs";
import type { loadMupdf } from "./mupdf-node.js";
import { groupWordsIntoLines, mergeCharsIntoWords } from "../../src/pdf/table-words.js";
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
        const stext = page.toStructuredText();
        const rawText = stext.asText();
        const chars: { text: string; x: number; y: number; fontSize: number }[] = [];
        stext.walk({
          onChar(c, origin, _font, size) {
            if (!c.trim()) return;
            chars.push({ text: c, x: origin[0], y: origin[1], fontSize: size });
          },
        });
        const words = mergeCharsIntoWords(chars);
        pages.push({
          index: i,
          width: bounds[2] - bounds[0],
          height: bounds[3] - bounds[1],
          lines: groupWordsIntoLines(words),
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

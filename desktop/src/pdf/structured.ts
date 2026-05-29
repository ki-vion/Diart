import { getMupdf } from "./mupdf-loader";
import { groupWordsIntoLines, mergeCharsIntoWords } from "./table-words";
import type { PdfStructured, PdfWord } from "./types";

function walkPageWords(
  stext: ReturnType<
    InstanceType<Awaited<ReturnType<typeof getMupdf>>["Page"]>["toStructuredText"]
  >,
): PdfWord[] {
  const chars: PdfWord[] = [];
  stext.walk({
    onChar(c, origin, _font, size) {
      if (!c.trim()) return;
      chars.push({ text: c, x: origin[0], y: origin[1], fontSize: size });
    },
  });
  return mergeCharsIntoWords(chars);
}

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
        const stext = page.toStructuredText();
        const rawText = stext.asText();
        const words = walkPageWords(stext);
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
    return { sourceFileName: file.name, pages };
  } finally {
    doc.destroy();
  }
}

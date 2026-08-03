import type { PdfStructured, PdfPageStructured } from "../types";
import { linesFromPdfWords, pdfWordsFromOcrBoxes } from "./lines-from-words";
import { forEachRenderedPdfPage } from "./render-pages";
import { recognizePng } from "./tesseract-worker";

async function ocrStructuredFromRendered(
  sourceFileName: string,
  file: File,
): Promise<PdfStructured> {
  const pages: PdfPageStructured[] = [];
  await forEachRenderedPdfPage(file, 144, async ({ png, meta }) => {
    const boxes = await recognizePng(png);
    const words = pdfWordsFromOcrBoxes(boxes, meta);
    const lines = linesFromPdfWords(words);
    const rawText = lines.map((l) => l.text).join("\n");
    pages.push({
      index: meta.pageIndex,
      width: meta.widthPt,
      height: meta.heightPt,
      lines,
      rawText,
    });
  });
  return { sourceFileName, pages };
}

export async function ocrStructuredFromPdf(file: File): Promise<PdfStructured> {
  return ocrStructuredFromRendered(file.name, file);
}

export async function ocrStructuredFromPdfBytes(
  pdfBytes: Uint8Array,
  sourceFileName: string,
): Promise<PdfStructured> {
  const file = new File([pdfBytes], sourceFileName, { type: "application/pdf" });
  return ocrStructuredFromRendered(sourceFileName, file);
}

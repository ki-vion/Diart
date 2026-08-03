import type { PdfLine, PdfWord } from "../types";
import type { OcrWordBox, PageRenderMeta } from "./types";

export type { OcrWordBox, PageRenderMeta } from "./types";

export function pdfWordsFromOcrBoxes(
  words: OcrWordBox[],
  meta: PageRenderMeta,
): PdfWord[] {
  const { scale } = meta;
  return words
    .filter((w) => w.text.trim().length > 0)
    .map((w) => ({
      text: w.text,
      x: w.x0 / scale,
      y: w.y0 / scale,
      fontSize: Math.max(6, (w.y1 - w.y0) / scale),
    }));
}

export function linesFromPdfWords(words: PdfWord[], yTol = 3): PdfLine[] {
  if (words.length === 0) return [];

  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: PdfLine[] = [];

  for (const w of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - w.y) <= yTol) {
      last.words.push(w);
      last.words.sort((a, b) => a.x - b.x);
      last.text = last.words.map((x) => x.text).join(" ");
      last.y = (last.y * (last.words.length - 1) + w.y) / last.words.length;
    } else {
      lines.push({ y: w.y, words: [w], text: w.text });
    }
  }

  return lines;
}

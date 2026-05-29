import type { PdfLine, PdfWord } from "./types";

/** Merge per-character MuPDF tokens into words (same baseline, small x gap). */
export function mergeCharsIntoWords(
  chars: PdfWord[],
  yTolerance = 3,
  xGapFactor = 1.15,
): PdfWord[] {
  if (chars.length === 0) return [];

  const sorted = [...chars].sort((a, b) => a.y - b.y || a.x - b.x);
  const words: PdfWord[] = [];
  let current: PdfWord | null = null;
  let lastEndX = 0;

  for (const c of sorted) {
    if (!current) {
      current = { ...c };
      lastEndX = c.x + c.fontSize * 0.45;
      continue;
    }

    const sameLine = Math.abs(current.y - c.y) <= yTolerance;
    const gap = c.x - lastEndX;
    const maxGap = Math.max(c.fontSize, current.fontSize) * xGapFactor;

    if (sameLine && gap <= maxGap) {
      current.text += c.text;
      current.y = (current.y + c.y) / 2;
      lastEndX = c.x + c.fontSize * 0.45;
    } else {
      words.push(current);
      current = { ...c };
      lastEndX = c.x + c.fontSize * 0.45;
    }
  }

  if (current) words.push(current);
  return words;
}

export function groupWordsIntoLines(words: PdfWord[], yTolerance = 3): PdfLine[] {
  if (words.length === 0) return [];

  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: PdfLine[] = [];

  for (const w of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - w.y) <= yTolerance) {
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

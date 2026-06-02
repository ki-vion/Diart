import type { PdfLine, PdfWord } from "./types";
import { mergeCharsIntoWords } from "./table-words";

type JsonLine = {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  bbox: { x: number; y: number; w: number; h: number };
};

type CharToken = { text: string; x: number; y: number; fontSize: number };

type Stext = {
  asJSON(scale: number): string;
  walk(walker: {
    onChar?: (
      c: string,
      origin: number[],
      font: unknown,
      size: number,
      quad: number[],
    ) => void;
  }): void;
};

function flattenJsonLines(stext: Stext): JsonLine[] {
  const data = JSON.parse(stext.asJSON(1.0)) as {
    blocks?: Array<{
      type?: string;
      lines?: Array<{
        x?: number;
        y?: number;
        text?: string;
        font?: { size?: number };
        bbox?: { x?: number; y?: number; w?: number; h?: number };
      }>;
    }>;
  };

  const out: JsonLine[] = [];
  for (const block of data.blocks ?? []) {
    if (block.type !== "text") continue;
    for (const line of block.lines ?? []) {
      const text = line.text ?? "";
      if (!text.trim()) continue;
      const x = line.x ?? line.bbox?.x ?? 0;
      const y = line.y ?? line.bbox?.y ?? 0;
      const bbox = line.bbox ?? { x, y, w: 0, h: line.font?.size ?? 10 };
      out.push({
        x,
        y,
        text,
        fontSize: line.font?.size ?? 10,
        bbox: {
          x: bbox.x ?? x,
          y: bbox.y ?? y,
          w: bbox.w ?? 0,
          h: bbox.h ?? line.font?.size ?? 10,
        },
      });
    }
  }
  return out;
}

function findLineForChar(lines: JsonLine[], x: number, y: number): number {
  const yTol = 4;
  let best = -1;
  let bestDist = Infinity;

  for (let i = 0; i < lines.length; i++) {
    const b = lines[i]!.bbox;
    const yMid = b.y + b.h / 2;
    if (Math.abs(y - yMid) > yTol && (y < b.y - yTol || y > b.y + b.h + yTol)) continue;
    const xMin = b.x - 2;
    const xMax = b.x + Math.max(b.w, 1) + 2;
    if (x < xMin || x > xMax) continue;
    const dist = Math.abs(y - yMid);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** Map JSON line text onto per-character tokens to recover word x positions. */
export function wordsFromLineText(
  lineText: string,
  chars: CharToken[],
  fontSize: number,
): PdfWord[] {
  const tokens = lineText.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const sorted = [...chars].sort((a, b) => a.x - b.x);
  const y = sorted[0]?.y ?? 0;

  if (sorted.length === 0) {
    return tokens.map((text, i) => ({
      text,
      x: 76 + i * 80,
      y,
      fontSize,
    }));
  }

  const words: PdfWord[] = [];
  let ci = 0;

  for (const token of tokens) {
    while (ci < sorted.length) {
      const remaining = sorted
        .slice(ci)
        .map((c) => c.text)
        .join("");
      if (remaining.startsWith(token)) break;
      ci++;
    }

    if (ci >= sorted.length) {
      words.push({
        text: token,
        x: sorted[sorted.length - 1]!.x,
        y,
        fontSize,
      });
      continue;
    }

    const startX = sorted[ci]!.x;
    let built = "";
    while (ci < sorted.length && built.length < token.length) {
      built += sorted[ci]!.text;
      ci++;
    }
    words.push({ text: token, x: startX, y, fontSize });
  }

  return words;
}

function buildPdfLine(jl: JsonLine, chars: CharToken[]): PdfLine {
  const y = jl.y;
  if (jl.text.trim()) {
    const words = wordsFromLineText(jl.text, chars, jl.fontSize);
    return { y, words, text: jl.text.trim() };
  }

  const merged = mergeCharsIntoWords(
    chars.map((c) => ({ text: c.text, x: c.x, y: c.y, fontSize: c.fontSize })),
  );
  const text = merged.map((w) => w.text).join(" ");
  return { y, words: merged, text };
}

/**
 * Build PdfLines from MuPDF structured text: one line per JSON text line,
 * with word spacing from JSON and x positions from character geometry.
 */
export function linesFromStructuredText(stext: Stext): PdfLine[] {
  const jsonLines = flattenJsonLines(stext);
  const charBuckets: CharToken[][] = jsonLines.map(() => []);

  stext.walk({
    onChar(c, origin, _font, size) {
      if (!c.trim()) return;
      const x = origin[0] ?? 0;
      const y = origin[1] ?? 0;
      const idx = findLineForChar(jsonLines, x, y);
      if (idx < 0) return;
      charBuckets[idx]!.push({ text: c, x, y, fontSize: size });
    },
  });

  const out = jsonLines.map((jl, i) => buildPdfLine(jl, charBuckets[i] ?? []));
  return out.filter((l) => l.text.trim()).sort((a, b) => a.y - b.y || (a.words[0]?.x ?? 0) - (b.words[0]?.x ?? 0));
}

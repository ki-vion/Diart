import type { ExtractionResult, LineItem } from "../models";
import {
  extractLaierArticleId,
  isLaierItemAnchor,
  isLaierSkipLine,
  parseLaierBlock,
} from "../table/laier-block";
import type { PdfLine } from "../../pdf/types";

const SKIP_PREFIXES = [
  "PREISBINDUNG",
  "Kom.:",
  "Dieser Artikel",
  "Die Rückgabe",
  "Sonstiges",
] as const;

function startsWithAnySkipPrefix(line: string): boolean {
  return SKIP_PREFIXES.some((p) => line.startsWith(p));
}

function lineToPdfLine(text: string, y: number): PdfLine {
  const words = text.split(/\s+/).filter(Boolean).map((t, i) => ({
    text: t,
    x: 40 + i * 40,
    y,
    fontSize: 10,
  }));
  return { y, words, text };
}

/** Fallback: flat text lines (explore script / legacy path). */
export function extractFromLines(lines: string[], source_pdf: string): ExtractionResult {
  const pdfLines = lines.map((t, i) => lineToPdfLine(t, i * 12));
  const items: LineItem[] = [];

  for (let i = 0; i < pdfLines.length; i++) {
    const line = pdfLines[i]!.text;
    if (!line || isLaierSkipLine(line) || startsWithAnySkipPrefix(line)) continue;
    if (!isLaierItemAnchor(pdfLines, i)) continue;

    let end = pdfLines.length;
    for (let j = i + 1; j < pdfLines.length; j++) {
      if (isLaierItemAnchor(pdfLines, j)) {
        end = j;
        break;
      }
    }

    const texts = pdfLines.slice(i, end).map((l) => l.text);
    const item = parseLaierBlock(texts);
    if (item) {
      item.position = String(items.length + 1);
      items.push(item);
    }
  }

  return { layout_id: "Rudolf Laier GmbH", source_pdf, items };
}

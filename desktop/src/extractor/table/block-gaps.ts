import type { PdfLine } from "../../pdf/types";

/** RK/STARK: marks the following position row in the table (not part of the previous item). */
export const RK_ALTERNATIVE_HEADER =
  /^Alternativposition\s+zu\s+Position\s+(\d+)/i;

/** KAN / IFB: intro lines before the next position anchor. */
const KAN_ALTERNATIVE_INTRO =
  /^Als Alternative schlagen wir/i;
const KAN_ALTERNATIVE_INTRO_CONT = /^folgenden Artikel vor:/i;

export function isAlternativpositionLine(text: string): boolean {
  return RK_ALTERNATIVE_HEADER.test(text.trim());
}

export function isKanAlternativeIntroLine(text: string): boolean {
  const t = text.trim();
  return KAN_ALTERNATIVE_INTRO.test(t) || KAN_ALTERNATIVE_INTRO_CONT.test(t);
}

function isCarryToNextLine(text: string): boolean {
  return isAlternativpositionLine(text) || isKanAlternativeIntroLine(text);
}

/**
 * KAN/IFB: intro lines may sit immediately before the position anchor (not in the
 * previous block), e.g. first row after „Übertrag“ on a continuation page.
 */
export function collectKanLeadingIntro(
  lines: PdfLine[],
  anchorIndex: number,
  minIndex: number,
): PdfLine[] {
  const intro: PdfLine[] = [];
  for (let i = anchorIndex - 1; i >= minIndex; i--) {
    const line = lines[i];
    if (!line) continue;
    const t = line.text.trim();
    if (!t) continue;
    if (isKanAlternativeIntroLine(t)) {
      intro.unshift(line);
    } else {
      break;
    }
  }
  return intro;
}

export function mergeKanPreamble(existing: PdfLine[], leading: PdfLine[]): PdfLine[] {
  const seen = new Set(existing.map((l) => l.text.trim()));
  const out = [...existing];
  for (const line of leading) {
    const t = line.text.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(line);
  }
  return out;
}

/**
 * Detach only trailing „Alternativposition zu Position …“ lines before the next anchor.
 * Other lines (e.g. ***starkverzinkt***) stay with the current position.
 */
export function splitBlockLinesForParsing(lines: PdfLine[]): {
  parseLines: PdfLine[];
  carryToNext: PdfLine[];
} {
  if (lines.length <= 1) {
    return { parseLines: lines, carryToNext: [] };
  }

  let splitAt = lines.length;

  for (let i = lines.length - 1; i >= 1; i--) {
    if (isCarryToNextLine(lines[i]!.text)) {
      splitAt = i;
    } else if (splitAt < lines.length) {
      break;
    }
  }

  if (splitAt >= lines.length) {
    return { parseLines: lines, carryToNext: [] };
  }

  const carryToNext = lines.slice(splitAt).filter((l) => isCarryToNextLine(l.text));
  return {
    parseLines: lines.slice(0, splitAt),
    carryToNext,
  };
}

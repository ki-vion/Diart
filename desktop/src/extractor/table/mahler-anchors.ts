import type { PdfLine } from "../../pdf/types";
import type { TableRegion } from "./table-region";
import { columnBand, textInColumn } from "./generic-anchors";
import { wordRightX } from "./line-guards";

/** Mahler Angebot: Positionsnummer mit Komma (z. B. 1,0 oder 12,0). */
export const MAHLER_POSITION_RE = /^\d{1,3},\d+$/;

const MAHLER_ARTICLE_RE = /^\d{5,7}(-\d{3})?$/;

export function looksLikeMahlerArticle(text: string): boolean {
  return MAHLER_ARTICLE_RE.test(text.trim());
}

export function isMahlerPositionAnchor(
  line: PdfLine,
  region: Pick<TableRegion, "boundaries" | "columnMap">,
): boolean {
  const posCol = region.columnMap.position ?? 0;
  const cell = textInColumn(line, region.boundaries, posCol);
  return MAHLER_POSITION_RE.test(cell);
}

function wordInColumnBand(
  line: PdfLine,
  boundaries: number[],
  colIndex: number,
): string[] {
  const band = columnBand(boundaries, colIndex);
  return line.words
    .filter((w) => {
      const left = w.x;
      const right = wordRightX(w);
      const overlap = Math.min(right, band.xMax) - Math.max(left, band.xMin);
      const width = Math.max(right - left, 0.001);
      return overlap / width >= 0.45;
    })
    .map((w) => w.text);
}

export function hasMahlerArticleNearAnchor(
  lines: PdfLine[],
  anchorIndex: number,
  region: Pick<TableRegion, "boundaries" | "columnMap" | "dataEndIndex">,
): boolean {
  const artCol = region.columnMap.article ?? 1;
  const end = Math.min(anchorIndex + 20, region.dataEndIndex, lines.length);
  const anchorY = lines[anchorIndex]?.y ?? 0;

  for (let i = anchorIndex; i < end; i++) {
    const line = lines[i]!;
    const art = textInColumn(line, region.boundaries, artCol);
    if (looksLikeMahlerArticle(art)) return true;

    for (const token of wordInColumnBand(line, region.boundaries, artCol)) {
      if (looksLikeMahlerArticle(token)) return true;
    }

    if (Math.abs(line.y - anchorY) <= 12) {
      for (const w of line.words) {
        if (looksLikeMahlerArticle(w.text)) return true;
      }
    }
  }
  return false;
}

export function findMahlerPositionAnchors(
  lines: PdfLine[],
  region: Pick<TableRegion, "dataStartIndex" | "dataEndIndex" | "boundaries" | "columnMap">,
): number[] {
  const anchors: number[] = [];
  for (let i = region.dataStartIndex; i < region.dataEndIndex; i++) {
    const line = lines[i]!;
    if (!line.text.trim()) continue;
    if (!isMahlerPositionAnchor(line, region)) continue;
    if (!hasMahlerArticleNearAnchor(lines, i, region)) continue;
    anchors.push(i);
  }
  return anchors;
}

import type { PdfLine } from "../../pdf/types";
import { wordRightX } from "./line-guards";
import type { TableRegion } from "./table-region";

/** Position in first column: 1–8 digits, optional decimal (1,0) or trailing dot (1.). */
export const GENERIC_POSITION_RE = /^\d{1,8}([,.]\d+)?\.?$/;

export function columnBand(
  boundaries: number[],
  colIndex: number,
  margin = 12,
): { xMin: number; xMax: number } {
  if (boundaries.length === 0) {
    return { xMin: 0, xMax: 120 };
  }
  const xMin = (boundaries[colIndex] ?? boundaries[0]!) - margin;
  const next = boundaries[colIndex + 1];
  const xMax =
    next !== undefined ? next + margin : (boundaries[boundaries.length - 1] ?? 600) + 80;
  return { xMin, xMax };
}

export function textInColumn(
  line: PdfLine,
  boundaries: number[],
  colIndex: number,
  minOverlap = 0.5,
): string {
  const band = columnBand(boundaries, colIndex);
  const words = line.words
    .filter((w) => {
      const left = w.x;
      const right = wordRightX(w);
      const overlap = Math.min(right, band.xMax) - Math.max(left, band.xMin);
      const width = Math.max(right - left, 0.001);
      return overlap / width >= minOverlap;
    })
    .sort((a, b) => a.x - b.x);
  return words.map((w) => w.text).join(" ").trim();
}

export function isGenericPositionAnchor(
  line: PdfLine,
  region: Pick<TableRegion, "boundaries" | "columnMap">,
): boolean {
  const posCol = region.columnMap.position ?? 0;
  const cell = textInColumn(line, region.boundaries, posCol);
  return GENERIC_POSITION_RE.test(cell);
}

export function findGenericPositionAnchors(
  lines: PdfLine[],
  region: Pick<TableRegion, "dataStartIndex" | "dataEndIndex" | "boundaries" | "columnMap">,
): number[] {
  const anchors: number[] = [];
  for (let i = region.dataStartIndex; i < region.dataEndIndex; i++) {
    const line = lines[i]!;
    if (!line.text.trim()) continue;
    if (isGenericPositionAnchor(line, region)) {
      anchors.push(i);
    }
  }
  return anchors;
}

export function regionHasGenericAnchors(
  lines: PdfLine[],
  region: TableRegion,
): boolean {
  return findGenericPositionAnchors(lines, region).length > 0;
}

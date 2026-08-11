import type { PdfLine } from "../../pdf/types";
import type { TableRegion } from "./table-region";
import { textInColumn } from "./generic-anchors";

/** Kölnsperger Auftragsbestätigung: Positionsnummer mit Punkt (z. B. 1. oder 18.). */
export const KOELNSPERGER_POSITION_RE = /^\d+\.$/;

/** 14-stellige Art-Nr., D-Codes oder L-Codes (Logistik). */
export const KOELNSPERGER_ARTICLE_RE = /^(\d{14}|D\d+|[A-Z]-\d+)$/;

export function looksLikeKoelnspergerArticle(text: string): boolean {
  return KOELNSPERGER_ARTICLE_RE.test(text.trim());
}

export function isKoelnspergerPositionAnchor(
  line: PdfLine,
  region: Pick<TableRegion, "boundaries" | "columnMap">,
): boolean {
  const posCol = region.columnMap.position ?? 0;
  const cell = textInColumn(line, region.boundaries, posCol);
  if (KOELNSPERGER_POSITION_RE.test(cell)) return true;
  return KOELNSPERGER_POSITION_RE.test(line.text.trim());
}

export function hasKoelnspergerArticleNearAnchor(
  lines: PdfLine[],
  anchorIndex: number,
  region: Pick<TableRegion, "boundaries" | "columnMap" | "dataEndIndex">,
): boolean {
  const artCol = region.columnMap.article ?? 1;
  const end = Math.min(anchorIndex + 8, region.dataEndIndex, lines.length);
  const anchorY = lines[anchorIndex]?.y ?? 0;

  for (let i = anchorIndex; i < end; i++) {
    const line = lines[i]!;
    const art = textInColumn(line, region.boundaries, artCol);
    if (looksLikeKoelnspergerArticle(art)) return true;

    if (Math.abs(line.y - anchorY) <= 2) {
      for (const w of line.words) {
        if (looksLikeKoelnspergerArticle(w.text)) return true;
      }
    }
  }
  return false;
}

export function findKoelnspergerPositionAnchors(
  lines: PdfLine[],
  region: Pick<TableRegion, "dataStartIndex" | "dataEndIndex" | "boundaries" | "columnMap">,
): number[] {
  const anchors: number[] = [];
  for (let i = region.dataStartIndex; i < region.dataEndIndex; i++) {
    const line = lines[i]!;
    if (!line.text.trim()) continue;
    if (!isKoelnspergerPositionAnchor(line, region)) continue;
    if (!hasKoelnspergerArticleNearAnchor(lines, i, region)) continue;
    anchors.push(i);
  }
  return anchors;
}

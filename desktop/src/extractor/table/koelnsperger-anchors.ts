import type { PdfLine } from "../../pdf/types";
import type { TableRegion } from "./table-region";
import { textInColumn } from "./generic-anchors";

/** Kölnsperger Auftragsbestätigung: Positionsnummer mit Punkt (z. B. 1. oder 18.). */
export const KOELNSPERGER_POSITION_RE = /^\d+\.$/;

/** Classic Art-Nr.: 14-stellige, D-Codes oder L-Codes (Logistik). */
export const KOELNSPERGER_ARTICLE_RE = /^(\d{14}|D\d+|[A-Z]-\d+)$/;

const UNITISH = /^(ST|St|ROL|M2|SA|Stück|Stk|kg|l|m²|m2|qm|Pal\.?|Karton|‰ST)$/i;
const NUMERICISH = /^[\d.,]+%?$/;

export function looksLikeKoelnspergerArticle(text: string): boolean {
  return KOELNSPERGER_ARTICLE_RE.test(text.trim());
}

/**
 * Value we accept as article_number from the Art-Nr. column:
 * classic codes plus free-form supplier codes (MT110-…, AP, BM-OSB15MM).
 * Single token only — multi-word strings are descriptions.
 */
export function isKoelnspergerArticleValue(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 48) return false;
  if (looksLikeKoelnspergerArticle(t)) return true;
  if (KOELNSPERGER_POSITION_RE.test(t)) return false;
  if (NUMERICISH.test(t) || UNITISH.test(t)) return false;
  if (/\s/.test(t)) return false;
  return /[A-Za-zÄÖÜäöüß]/.test(t);
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

/** Real row: nearby Art-Nr. cell, description, or billing — not a bare `N.` alone. */
export function hasKoelnspergerRowSignalNearAnchor(
  lines: PdfLine[],
  anchorIndex: number,
  region: Pick<TableRegion, "boundaries" | "columnMap" | "dataEndIndex">,
): boolean {
  const artCol = region.columnMap.article ?? 1;
  const descCol = region.columnMap.description ?? 2;
  const qtyCol = region.columnMap.quantity ?? 3;
  const unitPriceCol = region.columnMap.unitPrice ?? 5;
  const lineTotalCol = region.columnMap.lineTotal ?? 6;
  const end = Math.min(anchorIndex + 8, region.dataEndIndex, lines.length);
  const anchorY = lines[anchorIndex]?.y ?? 0;

  for (let i = anchorIndex; i < end; i++) {
    const line = lines[i]!;
    const art = textInColumn(line, region.boundaries, artCol);
    if (art && isKoelnspergerArticleValue(art)) return true;

    if (Math.abs(line.y - anchorY) > 2) continue;

    for (const w of line.words) {
      if (isKoelnspergerArticleValue(w.text)) return true;
    }

    const desc = textInColumn(line, region.boundaries, descCol);
    if (desc && /[A-Za-zÄÖÜäöüß]{2,}/.test(desc)) return true;

    for (const col of [qtyCol, unitPriceCol, lineTotalCol]) {
      const cell = textInColumn(line, region.boundaries, col).trim();
      if (cell && NUMERICISH.test(cell)) return true;
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
    if (!hasKoelnspergerRowSignalNearAnchor(lines, i, region)) continue;
    anchors.push(i);
  }
  return anchors;
}

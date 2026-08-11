import type { PdfLine } from "../../pdf/types";
import { lineToCells, trimCells } from "../pipeline/columns";
import { ECON_FLOOR_TEMPLATE } from "../pipeline/templates";

/** Commercial Offer: short position number in No. column. */
export const ECON_FLOOR_POSITION_RE = /^\d{1,3}$/;

/** Article codes: 4–8 digits, or letter/digit mixes like SL2592/SL3285. */
export const ECON_FLOOR_ARTICLE_RE =
  /^(\d{4,8}|[A-Z]{1,4}\d{2,}([/_\-][A-Z0-9]+)*)$/i;

const COL_WINDOWS = ECON_FLOOR_TEMPLATE.defaultWindows;
const COL_CATCH_ALL = ECON_FLOOR_TEMPLATE.descriptionCatchAllMaxX ?? 210;
const SAME_Y_TOL = 1.5;

export function looksLikeEconFloorArticle(text: string): boolean {
  return ECON_FLOOR_ARTICLE_RE.test(text.trim());
}

export function isEconFloorPositionAnchor(line: PdfLine): boolean {
  const t = line.text.trim();
  if (!ECON_FLOOR_POSITION_RE.test(t)) return false;
  // Only No. column — reject lone BOX/qty digits (e.g. "29", "0" at x≈216)
  const x = line.words[0]?.x ?? 999;
  if (x > 95) return false;
  const cells = trimCells(lineToCells(line, COL_WINDOWS, COL_CATCH_ALL));
  const pos = (cells.position ?? t).trim();
  return ECON_FLOOR_POSITION_RE.test(pos);
}

function hasBillingCells(line: PdfLine): boolean {
  const cells = trimCells(lineToCells(line, COL_WINDOWS, COL_CATCH_ALL));
  return Boolean(
    cells.quantity?.trim() ||
      cells.unitPrice?.trim() ||
      cells.lineTotal?.trim(),
  );
}

/** Real row: same-Y sibling with article or billing — filters stray digits (desc on next Y does not count). */
export function hasEconFloorRowSignal(lines: PdfLine[], anchorIndex: number): boolean {
  const anchorY = lines[anchorIndex]?.y ?? 0;
  for (let i = Math.max(0, anchorIndex - 2); i < Math.min(lines.length, anchorIndex + 6); i++) {
    const line = lines[i]!;
    if (Math.abs(line.y - anchorY) > SAME_Y_TOL) continue;
    if (i === anchorIndex && ECON_FLOOR_POSITION_RE.test(line.text.trim())) continue;

    if (looksLikeEconFloorArticle(line.text)) return true;
    if (hasBillingCells(line)) return true;

    const cells = trimCells(lineToCells(line, COL_WINDOWS, COL_CATCH_ALL));
    const desc = (cells.description ?? cells.article ?? "").trim();
    // Service name on the same baseline as No. (e.g. Transport), not a following desc line
    if (
      desc &&
      /[A-Za-zÄÖÜäöüß]{3,}/.test(desc) &&
      !/^\[EUR\]$/i.test(desc) &&
      Math.abs(line.y - anchorY) <= 0.5
    ) {
      return true;
    }
  }
  return false;
}

export function findEconFloorPositionAnchors(
  lines: PdfLine[],
  dataStartIndex: number,
  dataEndIndex: number,
): number[] {
  const anchors: number[] = [];
  for (let i = dataStartIndex; i < dataEndIndex; i++) {
    const line = lines[i]!;
    if (!line.text.trim()) continue;
    if (!isEconFloorPositionAnchor(line)) continue;
    if (!hasEconFloorRowSignal(lines, i)) continue;
    anchors.push(i);
  }
  return anchors;
}

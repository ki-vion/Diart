import type { LineItem } from "../models";
import type { PdfStructured } from "../../pdf/types";
import {
  extractBlocksFromPage,
  findBlockAnchors,
} from "./item-blocks";
import {
  findTableRegionOrContinuation,
  type TableRegion,
} from "./table-region";

function dedupeLineItems(items: LineItem[]): LineItem[] {
  const seen = new Set<string>();
  const out: LineItem[] = [];
  for (const it of items) {
    const key = [
      it.position ?? "",
      it.article_number ?? "",
      it.line_total ?? "",
      it.quantity ?? "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/**
 * Generic anchor-block extraction: table region per page → anchors → multi-line blocks.
 * Used by RK, KAN, Laier, Norit (block parser), and generic profile.
 */
export function extractAnchoredItems(
  structured: PdfStructured,
  layout_id: string,
): LineItem[] {
  const items: LineItem[] = [];

  for (const page of structured.pages) {
    const region = findTableRegionOrContinuation(page);
    if (!region) continue;

    const pageItems = extractBlocksFromPage(page, region);
    items.push(...pageItems);
  }

  void layout_id;
  return dedupeLineItems(items);
}

export function countAnchorsInRegion(
  page: { lines: { text: string }[] },
  region: TableRegion,
): number {
  return findBlockAnchors(page.lines as Parameters<typeof findBlockAnchors>[0], region.dataStartIndex).filter(
    (a) => a.lineIndex < region.dataEndIndex,
  ).length;
}

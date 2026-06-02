import type { LineItem } from "../models";
import type { PdfStructured } from "../../pdf/types";
import {
  extractBlocksFromPage,
  findBlockAnchors,
  type ItemBlockParseContext,
} from "./item-blocks";
import type { ColumnBlockContext } from "./column-block";
import {
  findTableRegionOrContinuation,
  type TableRegion,
} from "./table-region";

export type AnchorExtractOptions = {
  layout_id: string;
  /** Calibrated X-column windows (RK, future layouts). */
  columnBlock?: ColumnBlockContext;
};

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
  options: AnchorExtractOptions | string,
): LineItem[] {
  const opts: AnchorExtractOptions =
    typeof options === "string" ? { layout_id: options } : options;
  const parseCtx: ItemBlockParseContext | undefined = opts.columnBlock
    ? { columnBlock: opts.columnBlock }
    : undefined;

  const items: LineItem[] = [];

  for (const page of structured.pages) {
    const region = findTableRegionOrContinuation(page);
    if (!region) continue;

    const pageItems = extractBlocksFromPage(page, region, parseCtx);
    items.push(...pageItems);
  }

  void opts.layout_id;
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

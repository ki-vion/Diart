import type { LineItem } from "../models";
import type { PdfLine, PdfStructured } from "../../pdf/types";
import {
  extractBlocksFromPage,
  findBlockAnchors,
  type ItemBlockParseContext,
} from "./item-blocks";
import type { ColumnBlockContext } from "./column-block";
import {
  extractLaierArticleId,
  isLaierRCodeAnchorLine,
  parseLaierColumnBlock,
} from "./laier-block";
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

const LAIER_LAYOUT = "Rudolf Laier GmbH";

function findPendingLaierRHead(
  page: { lines: PdfLine[] },
  region: TableRegion,
  itemsFromPage: LineItem[],
): PdfLine | null {
  const anchors = findBlockAnchors(page.lines, region.dataStartIndex).filter(
    (a) => a.lineIndex < region.dataEndIndex,
  );
  const last = anchors[anchors.length - 1];
  if (!last || last.kind !== "laier") return null;

  const headLine = page.lines[last.lineIndex];
  const headText = headLine?.text.trim() ?? "";
  if (!headLine || !isLaierRCodeAnchorLine(headText)) return null;

  const id = extractLaierArticleId(headText);
  if (!id) return null;
  if (itemsFromPage.some((it) => it.article_number === id)) return null;
  return headLine;
}

function tryParseLaierOrphanContinuation(
  pendingHead: PdfLine,
  page: { lines: PdfLine[] },
  region: TableRegion,
  columnBlock: ColumnBlockContext,
): LineItem | null {
  const contLines = page.lines.slice(region.dataStartIndex, region.dataEndIndex);
  if (contLines.length === 0) return null;
  return parseLaierColumnBlock([pendingHead, ...contLines], columnBlock);
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
  const laierCrossPage = opts.layout_id === LAIER_LAYOUT && Boolean(opts.columnBlock);
  let pendingLaierHead: PdfLine | null = null;

  for (const page of structured.pages) {
    const region = findTableRegionOrContinuation(page);
    if (!region) continue;

    if (laierCrossPage && pendingLaierHead && opts.columnBlock) {
      const orphanItem = tryParseLaierOrphanContinuation(
        pendingLaierHead,
        page,
        region,
        opts.columnBlock,
      );
      if (orphanItem) {
        items.push(orphanItem);
        pendingLaierHead = null;
        continue;
      }
    }

    const pageItems = extractBlocksFromPage(page, region, parseCtx);
    items.push(...pageItems);

    if (laierCrossPage) {
      const nextPending = findPendingLaierRHead(page, region, pageItems);
      if (nextPending) {
        pendingLaierHead = nextPending;
      } else if (pendingLaierHead) {
        const pendingId = extractLaierArticleId(pendingLaierHead.text);
        const resolved =
          pendingId !== null &&
          pageItems.some((it) => it.article_number === pendingId);
        if (resolved || pageItems.length > 0) {
          pendingLaierHead = null;
        }
      }
    }
  }

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

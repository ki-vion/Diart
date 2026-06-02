import type { PdfLine, PdfPageStructured } from "../../pdf/types";
import {
  findBlockAnchors,
  type BlockAnchor,
  type BlockAnchorKind,
} from "./item-blocks";
import { findTableRegionOrContinuation, type TableRegion } from "./table-region";
import { isNonItemLine } from "./table-zone";

export type PageTableMeta = {
  region: TableRegion | null;
  anchors: BlockAnchor[];
  anchorByLineIndex: Map<number, BlockAnchorKind>;
};

export function getPageTableMeta(
  page: Pick<PdfPageStructured, "lines" | "height">,
): PageTableMeta {
  const region = findTableRegionOrContinuation(page);
  if (!region) {
    return { region: null, anchors: [], anchorByLineIndex: new Map() };
  }

  const anchors = findBlockAnchors(page.lines, region.dataStartIndex).filter(
    (a) => a.lineIndex < region.dataEndIndex,
  );
  const anchorByLineIndex = new Map(anchors.map((a) => [a.lineIndex, a.kind]));
  return { region, anchors, anchorByLineIndex };
}

export function lineInTableDataRegion(
  region: TableRegion | null,
  lineIndex: number,
): boolean {
  if (!region) return false;
  return lineIndex >= region.dataStartIndex && lineIndex < region.dataEndIndex;
}

/** Same anchor decision as `extractAnchoredItems` / `extractBlocksFromPage`. */
export function isProductionBlockAnchor(
  page: Pick<PdfPageStructured, "lines" | "height">,
  lineIndex: number,
  meta?: PageTableMeta,
): boolean {
  const m = meta ?? getPageTableMeta(page);
  if (!lineInTableDataRegion(m.region, lineIndex)) return false;
  const line = page.lines[lineIndex];
  if (!line) return false;
  if (isNonItemLine(line, page.height ?? 842)) return false;
  return m.anchorByLineIndex.has(lineIndex);
}

export function serializeTableRegion(region: TableRegion | null) {
  if (!region) return null;
  return {
    headerStart: region.headerStart,
    headerEnd: region.headerEnd,
    dataStart: region.dataStartIndex,
    dataEnd: region.dataEndIndex,
  };
}

export type ExploreLineFlags = {
  inTableRegion: boolean;
  isNonItem: boolean;
  isAnchor: boolean;
  anchorKind: BlockAnchorKind | null;
};

export function exploreLineFlags(
  page: Pick<PdfPageStructured, "lines" | "height">,
  lineIndex: number,
  meta?: PageTableMeta,
): ExploreLineFlags {
  const m = meta ?? getPageTableMeta(page);
  const line = page.lines[lineIndex];
  const inTable = lineInTableDataRegion(m.region, lineIndex);
  const nonItem = line ? isNonItemLine(line, page.height ?? 842) : false;
  const isAnchor = inTable && !nonItem && m.anchorByLineIndex.has(lineIndex);
  return {
    inTableRegion: inTable,
    isNonItem: nonItem,
    isAnchor,
    anchorKind: isAnchor ? (m.anchorByLineIndex.get(lineIndex) ?? null) : null,
  };
}

/** Pipeline template loop: block anchors inside the table body only. */
export function isBlockAnchorInTable(
  lines: PdfLine[],
  lineIndex: number,
  dataStart: number,
  dataEnd: number,
  pageHeight: number,
): boolean {
  const line = lines[lineIndex];
  if (!line) return false;
  if (lineIndex < dataStart || lineIndex >= dataEnd) return false;
  if (isNonItemLine(line, pageHeight)) return false;
  return findBlockAnchors(lines, dataStart).some((a) => a.lineIndex === lineIndex);
}

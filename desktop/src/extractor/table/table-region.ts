import type { PdfLine } from "../../pdf/types";
import {
  clusterLineIntoCells,
  inferColumnBoundaries,
  type WordToken,
} from "./cluster-columns";
import { HEADER_HINTS, type ColumnRole, type TableColumnMap } from "./header-map";
import { findBlockAnchors, scoreHeaderLine } from "./item-blocks";
import { isNonItemLine, isPostTableText } from "./table-zone";

export type TableRegion = {
  headerStart: number;
  headerEnd: number;
  /** First line index of item rows (exclusive of header). */
  dataStartIndex: number;
  /** Exclusive end of table body on this page. */
  dataEndIndex: number;
  boundaries: number[];
  columnMap: TableColumnMap;
};

const CORE_ROLES: ColumnRole[] = [
  "position",
  "article",
  "description",
  "quantity",
  "unit",
  "unitPrice",
  "lineTotal",
];

function mapColumnsFromCells(cells: string[]): TableColumnMap {
  const map: TableColumnMap = {};
  cells.forEach((cell, idx) => {
    const norm = cell.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
    if (!norm) return;
    for (const role of CORE_ROLES) {
      const hints = HEADER_HINTS[role];
      if (hints.some((h) => norm.includes(h.replace(/\./g, "")))) {
        if (map[role] === undefined) map[role] = idx;
      }
    }
  });
  return map;
}

/** Table detected without requiring a Betrag/line-total column. */
export function isValidTableHeader(columnMap: TableColumnMap, hintScore: number): boolean {
  if (hintScore < 2) return false;

  const mappedRoles = CORE_ROLES.filter((r) => columnMap[r] !== undefined);
  if (mappedRoles.length < 2) return false;

  const hasIdentity =
    columnMap.position !== undefined || columnMap.article !== undefined;
  const hasItemColumn =
    columnMap.description !== undefined ||
    columnMap.quantity !== undefined ||
    columnMap.unit !== undefined ||
    columnMap.unitPrice !== undefined;

  return hasIdentity && hasItemColumn;
}

function lineIsAnchor(lines: PdfLine[], index: number): boolean {
  return findBlockAnchors(lines, index).some((a) => a.lineIndex === index);
}

/**
 * Words mostly fall inside inferred column bands (+ margin).
 * Prose below the table is usually full-width at a different x.
 */
export function lineFitsTableGrid(
  line: PdfLine,
  boundaries: number[],
  _columnMap: TableColumnMap,
): boolean {
  if (boundaries.length < 2 || line.words.length === 0) return true;

  const xMin = Math.min(...boundaries);
  const xMax = Math.max(...boundaries);
  const margin = 28;
  const inBand = line.words.filter(
    (w) => w.x >= xMin - margin && w.x <= xMax + margin,
  ).length;

  return inBand / line.words.length >= 0.55;
}

export function findTableEndIndex(
  page: { lines: PdfLine[]; height?: number },
  dataStartIndex: number,
  boundaries: number[],
  columnMap: TableColumnMap,
): number {
  const lines = page.lines;
  const pageHeight = page.height ?? 842;
  let sawAnchor = false;

  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i]!;
    const text = line.text.trim();
    if (!text) continue;

    if (lineIsAnchor(lines, i)) {
      sawAnchor = true;
    }

    if (isNonItemLine(line, pageHeight)) {
      return i;
    }

    if (sawAnchor && isPostTableText(text)) {
      return i;
    }
  }

  return lines.length;
}

export function findTableRegion(page: {
  lines: PdfLine[];
  height?: number;
}): TableRegion | null {
  const lines = page.lines;
  let headerStart = -1;
  let headerEnd = -1;
  let bestScore = 0;

  for (let i = 0; i < lines.length; i++) {
    const score = scoreHeaderLine(lines[i]!.text);
    if (score > 0) {
      if (headerStart < 0) headerStart = i;
      headerEnd = i;
      bestScore = Math.max(bestScore, score);
    }
  }

  if (headerStart < 0) return null;

  while (headerEnd + 1 < lines.length) {
    const next = lines[headerEnd + 1]!.text.trim();
    if (!next) {
      headerEnd += 1;
      continue;
    }
    if (findBlockAnchors(lines, headerEnd + 1).some((a) => a.lineIndex === headerEnd + 1)) {
      break;
    }
    if (scoreHeaderLine(next) > 0 || /^(in\s+eur|me|pe)$/i.test(next)) {
      headerEnd += 1;
      continue;
    }
    break;
  }

  const headerTokens: WordToken[] = [];
  for (let i = headerStart; i <= headerEnd; i++) {
    for (const w of lines[i]!.words) {
      headerTokens.push({ text: w.text, x: w.x });
    }
  }

  const boundaries = inferColumnBoundaries(headerTokens);
  const headerCells = clusterLineIntoCells(headerTokens, boundaries);
  const columnMap = mapColumnsFromCells(headerCells);

  if (!isValidTableHeader(columnMap, bestScore)) return null;

  const dataStartIndex = headerEnd + 1;
  let dataEndIndex = findTableEndIndex(page, dataStartIndex, boundaries, columnMap);

  if (dataEndIndex <= dataStartIndex) {
    dataEndIndex = lines.length;
  }

  return {
    headerStart,
    headerEnd,
    dataStartIndex,
    dataEndIndex,
    boundaries,
    columnMap,
  };
}

/** Continuation pages without a repeated header row. */
export function findTableRegionOrContinuation(page: {
  lines: PdfLine[];
  height?: number;
}): TableRegion | null {
  const found = findTableRegion(page);
  if (found) return found;

  const pageHeight = page.height ?? 842;
  let dataStart = 0;
  for (let i = 0; i < page.lines.length; i++) {
    const line = page.lines[i]!;
    if (!isNonItemLine(line, pageHeight) && line.text.trim()) {
      dataStart = i;
      break;
    }
  }

  const anchors = findBlockAnchors(page.lines, dataStart);
  if (anchors.length === 0) return null;

  const dataEndIndex = findTableEndIndex(page, dataStart, [], {});

  return {
    headerStart: -1,
    headerEnd: -1,
    dataStartIndex: dataStart,
    dataEndIndex,
    boundaries: [],
    columnMap: {},
  };
}

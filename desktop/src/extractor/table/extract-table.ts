import type { ExtractionResult, LineItem } from "../models";
import { parseDeNumber } from "../utils";
import {
  clusterLineIntoCells,
  inferColumnBoundaries,
  type WordToken,
} from "./cluster-columns";
import { HEADER_HINTS, type ColumnRole, type TableColumnMap } from "./header-map";
import { extractBlocksFromPage, findBlockAnchors, scoreHeaderLine } from "./item-blocks";
import { findTableRegion, findTableRegionOrContinuation } from "./table-region";
import { isNonItemLine } from "./table-zone";
import type { PdfLine, PdfPageStructured, PdfStructured } from "../../pdf/types";

export type { TableColumnMap } from "./header-map";

const FOOTER_RE =
  /^(summe|gesamt|übertrag|uebertrag|mwst|netto|brutto|subtotal|total|endsumme)/i;

const POS_RE = /^(?<pos>\d{1,5})\b/;
const ARTICLE_NUM_RE = /^(?:artikelnummer:\s*)?(\d{6,10})\b/i;

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
}

function lineToTokens(line: PdfLine): WordToken[] {
  return line.words.map((w) => ({ text: w.text, x: w.x }));
}

function mapColumnsFromCells(cells: string[]): TableColumnMap {
  const map: TableColumnMap = {};
  cells.forEach((cell, idx) => {
    const norm = normalizeToken(cell);
    if (!norm) return;
    for (const role of Object.keys(HEADER_HINTS) as ColumnRole[]) {
      const hints = HEADER_HINTS[role];
      if (hints.some((h) => norm.includes(normalizeToken(h)))) {
        if (map[role] === undefined) map[role] = idx;
      }
    }
  });
  return map;
}

function findSingleLineTable(page: PdfPageStructured): {
  headerIndex: number;
  boundaries: number[];
  columnMap: TableColumnMap;
} | null {
  let best: {
    headerIndex: number;
    score: number;
    boundaries: number[];
    columnMap: TableColumnMap;
  } | null = null;

  for (let i = 0; i < page.lines.length; i++) {
    const line = page.lines[i]!;
    const score = scoreHeaderLine(line.text);
    if (score < 2) continue;

    const tokens = lineToTokens(line);
    const boundaries = inferColumnBoundaries(tokens);
    const cells = clusterLineIntoCells(tokens, boundaries);
    const columnMap = mapColumnsFromCells(cells);

    if (!best || score > best.score) {
      best = { headerIndex: i, score, boundaries, columnMap };
    }
  }

  if (!best) return null;
  return {
    headerIndex: best.headerIndex,
    boundaries: best.boundaries,
    columnMap: best.columnMap,
  };
}

function isFooterLine(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (FOOTER_RE.test(t)) return true;
  if (/^seite\s+\d+/i.test(t)) return true;
  if (t.startsWith("Übertrag") || t.startsWith("Uebertrag")) return true;
  return false;
}

function cellAt(cells: string[], col: number | undefined): string {
  if (col === undefined || col < 0) return "";
  return (cells[col] ?? "").trim();
}

function parseArticleCell(cell: string): string | null {
  const m = ARTICLE_NUM_RE.exec(cell);
  if (m?.[1]) return m[1];
  if (/^\d{6,10}$/.test(cell.trim())) return cell.trim();
  return null;
}

function rowToLineItem(cells: string[], map: TableColumnMap): LineItem | null {
  const posCell = cellAt(cells, map.position);
  const posMatch = POS_RE.exec(posCell);
  const position = posMatch?.groups?.pos ?? (POS_RE.test(posCell) ? posCell : null);

  const articleCell = cellAt(cells, map.article);
  const article_number = parseArticleCell(articleCell) ?? parseArticleCell(cells.join(" "));

  const description = cellAt(cells, map.description) || cells.filter(Boolean).join(" ").trim();

  const quantity = parseDeNumber(cellAt(cells, map.quantity));
  const unit = cellAt(cells, map.unit) || null;
  const unit_price = parseDeNumber(cellAt(cells, map.unitPrice));
  const line_total = parseDeNumber(cellAt(cells, map.lineTotal));

  const hasNumeric =
    quantity !== null || unit_price !== null || line_total !== null;
  const hasIdentity = Boolean(position || article_number);

  if (!hasNumeric && !hasIdentity) return null;
  if (!hasNumeric) return null;

  return {
    position: position ?? null,
    article_number,
    description: description || articleCell || posCell,
    quantity,
    unit: unit && unit.length <= 12 ? unit : null,
    unit_price,
    line_total,
  };
}

function isDescriptionOnlyRow(cells: string[], map: TableColumnMap): boolean {
  const desc = cellAt(cells, map.description);
  if (!desc) return false;
  const qtyCol = map.quantity;
  const priceCol = map.unitPrice;
  const hasOther =
    cells.some((c, i) => {
      if (!c.trim()) return false;
      if (i === map.description) return false;
      if (qtyCol === i || priceCol === i || i === map.position) return parseDeNumber(c) !== null;
      return true;
    }) && cells.filter((c) => c.trim()).length > 1;
  return !hasOther;
}

/** One-line-per-row tables (all columns on the same baseline). */
function extractSingleLineRows(
  page: PdfPageStructured,
  table: {
    headerIndex: number;
    dataEndIndex: number;
    boundaries: number[];
    columnMap: TableColumnMap;
  },
): LineItem[] {
  const { headerIndex, dataEndIndex, boundaries, columnMap } = table;
  const items: LineItem[] = [];

  for (let i = headerIndex + 1; i < dataEndIndex; i++) {
    const line = page.lines[i]!;
    if (isFooterLine(line.text) || isNonItemLine(line, page.height)) continue;

    const cells = clusterLineIntoCells(lineToTokens(line), boundaries);
    if (cells.every((c) => !c.trim())) continue;

    if (isDescriptionOnlyRow(cells, columnMap) && items.length > 0) {
      const last = items[items.length - 1]!;
      const extra = cellAt(cells, columnMap.description) || cells.join(" ").trim();
      if (extra) last.description = `${last.description} ${extra}`.trim();
      continue;
    }

    const item = rowToLineItem(cells, columnMap);
    if (item) items.push(item);
  }

  return items;
}

function extractFromPage(page: PdfPageStructured): LineItem[] {
  const region = findTableRegionOrContinuation(page);
  if (region) {
    const anchors = findBlockAnchors(page.lines, region.dataStartIndex).filter(
      (a) => a.lineIndex < region.dataEndIndex,
    );
    if (anchors.length >= 1) {
      const blockItems = extractBlocksFromPage(page, region);
      if (blockItems.length > 0) return blockItems;
    }
  }

  const singleLine = findSingleLineTable(page);
  if (singleLine) {
    const fullRegion = findTableRegion(page);
    const dataEndIndex = fullRegion?.dataEndIndex ?? page.lines.length;
    return extractSingleLineRows(page, { ...singleLine, dataEndIndex });
  }

  return [];
}

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

export function extractTableItems(
  structured: PdfStructured,
  source_pdf: string,
): ExtractionResult {
  const items: LineItem[] = [];
  for (const page of structured.pages) {
    items.push(...extractFromPage(page));
  }

  return {
    layout_id: "table_geometry",
    source_pdf,
    items: dedupeLineItems(items),
  };
}

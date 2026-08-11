import type { LineItem } from "../models";
import { parseDeNumber } from "../utils";
import { clusterLineIntoCells, type WordToken } from "./cluster-columns";
import type { ColumnRole, TableColumnMap } from "./header-map";
import {
  findGenericPositionAnchors,
  GENERIC_POSITION_RE,
  isGenericPositionAnchor,
  textInColumn,
} from "./generic-anchors";
import { isHardTableEndLine } from "./line-guards";
import { isNonItemLine, isPostTableText } from "./table-zone";
import type { TableRegion } from "./table-region";
import type { PdfLine, PdfPageStructured } from "../../pdf/types";

const FOOTER_RE =
  /^(summe|zwischensumme|gesamt|übertrag|uebertrag|mwst|netto|brutto|subtotal|total|endsumme)/i;

const ARTICLE_NUM_RE = /^(?:artikelnummer:\s*)?(\d{4,10})\b/i;
const UNIT_ONLY =
  /^(?<u>ST|M2|SA|St|Stück|Stk|kg|l|m²|m2|qm|Pal\.?|Karton|M|Stk\.)$/i;

function lineToTokens(line: PdfLine): WordToken[] {
  return line.words.map((w) => ({ text: w.text, x: w.x }));
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
  if (/^\d{4,10}$/.test(cell.trim())) return cell.trim();
  return null;
}

function stripCurrency(s: string): string {
  return s.replace(/\s*EUR\b/gi, "").trim();
}

function rowToLineItem(cells: string[], map: TableColumnMap): LineItem | null {
  const posCell = cellAt(cells, map.position);
  const position = GENERIC_POSITION_RE.test(posCell) ? posCell : null;

  const articleCell = cellAt(cells, map.article);
  const article_number = parseArticleCell(articleCell) ?? parseArticleCell(cells.join(" "));

  const description = cellAt(cells, map.description) || cells.filter(Boolean).join(" ").trim();

  const quantity = parseDeNumber(stripCurrency(cellAt(cells, map.quantity)));
  const unit = cellAt(cells, map.unit) || null;
  const unit_price = parseDeNumber(stripCurrency(cellAt(cells, map.unitPrice)));
  const line_total = parseDeNumber(stripCurrency(cellAt(cells, map.lineTotal)));

  const hasNumeric = quantity !== null || unit_price !== null || line_total !== null;
  if (!hasNumeric) return null;

  return {
    position,
    article_number,
    artikel_prefix: null,
    description: description || articleCell || posCell,
    quantity,
    unit: unit && unit.length <= 12 ? unit : null,
    unit_price,
    line_total,
  };
}

function lineHasBillingContent(
  line: PdfLine,
  boundaries: number[],
  columnMap: TableColumnMap,
): boolean {
  const roles: ColumnRole[] = ["quantity", "unit", "unitPrice", "lineTotal"];
  for (const role of roles) {
    const col = columnMap[role];
    if (col === undefined) continue;
    const t = textInColumn(line, boundaries, col);
    if (!t) continue;
    if (role === "unit") return true;
    if (parseDeNumber(stripCurrency(t)) !== null) return true;
  }
  return false;
}

function lineHasArticleContent(
  line: PdfLine,
  boundaries: number[],
  columnMap: TableColumnMap,
): boolean {
  const col = columnMap.article;
  if (col === undefined) return false;
  const t = textInColumn(line, boundaries, col);
  return Boolean(t && parseArticleCell(t));
}

function mergeLineIntoItem(
  line: PdfLine,
  region: Pick<TableRegion, "boundaries" | "columnMap">,
  merged: string[],
  descParts: string[],
): void {
  const { boundaries, columnMap } = region;
  if (isFooterLine(line.text)) return;

  if (
    !lineHasBillingContent(line, boundaries, columnMap) &&
    !isGenericPositionAnchor(line, region) &&
    !lineHasArticleContent(line, boundaries, columnMap)
  ) {
    const descCol = columnMap.description ?? 1;
    const desc =
      textInColumn(line, boundaries, descCol) ||
      clusterLineIntoCells(lineToTokens(line), boundaries)
        .filter(Boolean)
        .join(" ")
        .trim() ||
      line.text.trim();
    if (desc) descParts.push(desc);
    return;
  }

  const cells = clusterLineIntoCells(lineToTokens(line), boundaries);
  for (let c = 0; c < cells.length; c++) {
    const val = cells[c]?.trim();
    if (!val) continue;
    if (c === columnMap.description) {
      merged[c] = merged[c] ? `${merged[c]} ${val}`.trim() : val;
    } else {
      merged[c] = val;
    }
  }
}

function parseGenericBlock(
  lines: PdfLine[],
  start: number,
  end: number,
  region: Pick<TableRegion, "boundaries" | "columnMap">,
): LineItem | null {
  const colCount = Math.max(region.boundaries.length, 1);
  const merged = new Array<string>(colCount).fill("");
  const descParts: string[] = [];

  for (let i = start; i < end; i++) {
    mergeLineIntoItem(lines[i]!, region, merged, descParts);
  }

  const item = rowToLineItem(merged, region.columnMap);
  if (!item) return null;

  if (!item.unit) {
    for (let i = start; i < end; i++) {
      const t = lines[i]!.text.trim();
      const unitMatch = UNIT_ONLY.exec(t);
      if (unitMatch?.groups?.u) {
        item.unit = unitMatch.groups.u;
        break;
      }
    }
  }

  if (descParts.length > 0) {
    const extra = descParts.join("\n").trim();
    item.description = item.description ? `${item.description}\n${extra}`.trim() : extra;
  }

  return item;
}

export function findGenericTableEndIndex(
  page: Pick<PdfPageStructured, "lines" | "height">,
  region: TableRegion,
  anchors: number[],
): number {
  const lines = page.lines;
  const pageHeight = page.height ?? 842;
  const anchorSet = new Set(anchors);
  let sawAnchor = false;

  for (let i = region.dataStartIndex; i < lines.length; i++) {
    const line = lines[i]!;
    const text = line.text.trim();
    if (!text) continue;

    if (anchorSet.has(i)) sawAnchor = true;

    if (isHardTableEndLine(text)) {
      if (sawAnchor) return i;
      continue;
    }

    if (isNonItemLine(line, pageHeight)) {
      if (sawAnchor) return i;
      continue;
    }

    if (sawAnchor && isPostTableText(text)) {
      return i;
    }
  }

  return lines.length;
}

/** Multi-line rows: position anchor in first column, other fields on same or following lines. */
export function extractGenericMultiLineItems(
  page: PdfPageStructured,
  region: TableRegion,
): LineItem[] {
  let anchors = findGenericPositionAnchors(page.lines, region);
  if (anchors.length === 0) return [];

  const dataEndIndex = findGenericTableEndIndex(page, region, anchors);
  const effectiveRegion = { ...region, dataEndIndex };
  anchors = anchors.filter((i) => i < dataEndIndex);
  if (anchors.length === 0) return [];

  const items: LineItem[] = [];
  for (let a = 0; a < anchors.length; a++) {
    const start = anchors[a]!;
    const end = a + 1 < anchors.length ? anchors[a + 1]! : dataEndIndex;
    const item = parseGenericBlock(page.lines, start, end, effectiveRegion);
    if (item) items.push(item);
  }

  return items;
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
export function extractGenericSingleLineRows(
  page: PdfPageStructured,
  region: TableRegion,
): LineItem[] {
  const { boundaries, columnMap, dataStartIndex } = region;
  const dataEndIndex =
    region.dataEndIndex > dataStartIndex
      ? region.dataEndIndex
      : findGenericTableEndIndex(page, region, []);

  const items: LineItem[] = [];

  for (let i = dataStartIndex; i < dataEndIndex; i++) {
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

export function extractGenericTableItems(
  page: PdfPageStructured,
  region: TableRegion,
): LineItem[] {
  const multi = extractGenericMultiLineItems(page, region);
  if (multi.length > 0) return multi;
  return extractGenericSingleLineRows(page, region);
}

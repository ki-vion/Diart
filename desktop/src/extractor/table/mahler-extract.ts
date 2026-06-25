import type { LineItem } from "../models";
import { parseDeNumber } from "../utils";
import { clusterLineIntoCells, type WordToken } from "./cluster-columns";
import type { ColumnRole, TableColumnMap } from "./header-map";
import { findGenericTableEndIndex } from "./generic-extract";
import { textInColumn } from "./generic-anchors";
import {
  findMahlerPositionAnchors,
  isMahlerPositionAnchor,
  MAHLER_POSITION_RE,
} from "./mahler-anchors";
import { isNonItemLine } from "./table-zone";
import type { TableRegion } from "./table-region";
import type { PdfLine, PdfPageStructured, PdfStructured } from "../../pdf/types";
import { findTableRegion } from "./table-region";

const ARTICLE_NUM_RE = /^(\d{5,7})(-\d{3})?$/;
const UNIT_ONLY =
  /^(?<u>ST|M2|SA|St|Stück|Stk|kg|l|m²|m2|qm|Pal\.?|Karton|M|Stk\.)$/i;
const SKIP_DESC =
  /^(pos$|art\.-nr\.?$|bezeichnung$|menge$|einzelpreis$|gesamtpreis$|in eur$)/i;

const MAHLER_SKIP_DESC_LINE =
  /^(Abholung vom Lager|Kommission Abholung|GmbH)$/i;

/** Letterhead / footer fragments that bleed into the last item on a page. */
const MAHLER_IMPRINT_DESC =
  /^(Bauwaren Mahler|Gögginger|86159\s+Augsburg|\d{5}\s+[A-ZÄÖÜ][\wäöüß-]*)/i;

export function isMahlerSkipDescriptionLine(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (MAHLER_SKIP_DESC_LINE.test(t)) return true;
  if (MAHLER_IMPRINT_DESC.test(t)) return true;
  if (/^GmbH\s+\d{5}\s+/i.test(t)) return true;
  return false;
}

export function cleanMahlerDescription(description: string): string {
  return description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !isMahlerSkipDescriptionLine(line))
    .join("\n")
    .trim();
}

function lineToTokens(line: PdfLine): WordToken[] {
  return line.words.map((w) => ({ text: w.text, x: w.x }));
}

function stripCurrency(s: string): string {
  return s.replace(/\s*EUR\b/gi, "").trim();
}

function cellAt(cells: string[], col: number | undefined): string {
  if (col === undefined || col < 0) return "";
  return (cells[col] ?? "").trim();
}

function parseArticleCell(cell: string): string | null {
  const t = cell.trim();
  const m = ARTICLE_NUM_RE.exec(t);
  if (m) return m[1] ?? t;
  return null;
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
  const col = columnMap.article ?? 1;
  const t = textInColumn(line, boundaries, col);
  return Boolean(t && parseArticleCell(t));
}

function descriptionTextInColumn(
  line: PdfLine,
  boundaries: number[],
  columnMap: TableColumnMap,
): string {
  const descCol = columnMap.description ?? 2;
  return textInColumn(line, boundaries, descCol);
}

function mergeBillingLine(
  line: PdfLine,
  region: Pick<TableRegion, "boundaries" | "columnMap">,
  merged: string[],
): void {
  const cells = clusterLineIntoCells(lineToTokens(line), region.boundaries);
  for (let c = 0; c < cells.length; c++) {
    const val = cells[c]?.trim();
    if (!val) continue;
    if (c === region.columnMap.description) continue;
    merged[c] = val;
  }
}

function parseMahlerRow(merged: string[], map: TableColumnMap): Omit<LineItem, "description"> | null {
  const posCell = cellAt(merged, map.position);
  const position = MAHLER_POSITION_RE.test(posCell) ? posCell : null;

  const articleCell = cellAt(merged, map.article);
  const article_number = parseArticleCell(articleCell);

  const quantity = parseDeNumber(stripCurrency(cellAt(merged, map.quantity)));
  const unit_price = parseDeNumber(stripCurrency(cellAt(merged, map.unitPrice)));
  const line_total = parseDeNumber(stripCurrency(cellAt(merged, map.lineTotal)));

  const hasNumeric = quantity !== null || unit_price !== null || line_total !== null;
  if (!hasNumeric || !article_number) return null;

  let unit: string | null = cellAt(merged, map.unit) || null;
  if (unit && unit.length > 12) unit = null;

  return {
    position,
    article_number,
    artikel_prefix: null,
    quantity,
    unit,
    unit_price,
    line_total,
  };
}

function parseMahlerBlock(
  lines: PdfLine[],
  start: number,
  end: number,
  region: Pick<TableRegion, "boundaries" | "columnMap">,
): LineItem | null {
  const colCount = Math.max(region.boundaries.length, 1);
  const merged = new Array<string>(colCount).fill("");
  const descParts: string[] = [];

  for (let i = start; i < end; i++) {
    const line = lines[i]!;
    const text = line.text.trim();
    if (!text || SKIP_DESC.test(text)) continue;
    if (isNonItemLine(line, 842)) continue;

    if (
      isMahlerPositionAnchor(line, region) ||
      lineHasBillingContent(line, region.boundaries, region.columnMap) ||
      lineHasArticleContent(line, region.boundaries, region.columnMap)
    ) {
      mergeBillingLine(line, region, merged);
    }

    const desc = descriptionTextInColumn(line, region.boundaries, region.columnMap);
    if (
      desc &&
      !SKIP_DESC.test(desc) &&
      !MAHLER_POSITION_RE.test(desc) &&
      !parseArticleCell(desc) &&
      !isMahlerSkipDescriptionLine(desc)
    ) {
      if (!descParts.includes(desc)) descParts.push(desc);
      continue;
    }

    if (
      !lineHasBillingContent(line, region.boundaries, region.columnMap) &&
      !isMahlerPositionAnchor(line, region) &&
      !lineHasArticleContent(line, region.boundaries, region.columnMap) &&
      !UNIT_ONLY.test(text) &&
      !isMahlerSkipDescriptionLine(text)
    ) {
      if (!descParts.includes(text)) descParts.push(text);
    }
  }

  const core = parseMahlerRow(merged, region.columnMap);
  if (!core) {
    const artCol = region.columnMap.article ?? 1;
    for (let i = start; i < end; i++) {
      const art = textInColumn(lines[i]!, region.boundaries, artCol);
      if (parseArticleCell(art)) {
        merged[artCol] = art;
        break;
      }
    }
  }

  const parsed = parseMahlerRow(merged, region.columnMap);
  if (!parsed) return null;

  if (!parsed.unit) {
    for (let i = start; i < end; i++) {
      const unitMatch = UNIT_ONLY.exec(lines[i]!.text.trim());
      if (unitMatch?.groups?.u) {
        parsed.unit = unitMatch.groups.u;
        break;
      }
    }
  }

  return {
    ...parsed,
    description: cleanMahlerDescription(
      descParts.join("\n").trim() || cellAt(merged, region.columnMap.description),
    ),
  };
}

function extractFromPage(page: PdfPageStructured): LineItem[] {
  const region = findTableRegion(page);
  if (!region) return [];

  let anchors = findMahlerPositionAnchors(page.lines, region);
  if (anchors.length === 0) return [];

  const dataEndIndex = findGenericTableEndIndex(page, region, anchors);
  const effectiveRegion = { ...region, dataEndIndex };
  anchors = anchors.filter((i) => i < dataEndIndex);
  if (anchors.length === 0) return [];

  const items: LineItem[] = [];
  for (let a = 0; a < anchors.length; a++) {
    const start = anchors[a]!;
    const end = a + 1 < anchors.length ? anchors[a + 1]! : dataEndIndex;
    const item = parseMahlerBlock(page.lines, start, end, effectiveRegion);
    if (item) items.push(item);
  }
  return items;
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

export function extractMahlerItems(
  structured: PdfStructured,
  source_pdf: string,
): { items: LineItem[] } {
  const items: LineItem[] = [];
  for (const page of structured.pages) {
    items.push(...extractFromPage(page));
  }
  return { items: dedupeLineItems(items) };
}

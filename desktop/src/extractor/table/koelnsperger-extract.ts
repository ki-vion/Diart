import type { LineItem } from "../models";
import { parseDeNumber } from "../utils";
import { lineToCells, trimCells } from "../pipeline/columns";
import type { RowCells } from "../pipeline/types";
import type { ColumnRole, TableColumnMap } from "./header-map";
import { findGenericTableEndIndex } from "./generic-extract";
import {
  findKoelnspergerPositionAnchors,
  hasKoelnspergerArticleNearAnchor,
  KOELNSPERGER_POSITION_RE,
  looksLikeKoelnspergerArticle,
} from "./koelnsperger-anchors";
import { isNonItemLine } from "./table-zone";
import type { TableRegion } from "./table-region";
import type { PdfLine, PdfPageStructured, PdfStructured } from "../../pdf/types";
import { findTableRegion, findTableRegionOrContinuation } from "./table-region";
import { KOELNSPERGER_TEMPLATE } from "../pipeline/templates";

const COL_WINDOWS = KOELNSPERGER_TEMPLATE.defaultWindows;
const COL_CATCH_ALL = KOELNSPERGER_TEMPLATE.descriptionCatchAllMaxX ?? 360;

const FIXED_BOUNDARIES = COL_WINDOWS.map((w) => w.xMax);
const FIXED_COLUMN_MAP: TableColumnMap = {
  position: 0,
  article: 1,
  description: 2,
  quantity: 3,
  unit: 4,
  unitPrice: 5,
  lineTotal: 6,
};

const UNIT_ONLY =
  /^(?<u>ST|St|ROL|M2|SA|Stück|Stk|kg|l|m²|m2|qm|Pal\.?|Karton|‰ST)$/i;
const SKIP_LINE =
  /^(pos\.?|art-nr|artikel|mge|einh|e-preis|rabatt|ges\.\s*preis|übertrag|uebertrag|zwischensumme|gesamt|in eur$)/i;
const RABATT_LINE = /^\d{1,2}%$/;
const PRICE_NOTE = /^\(\/(?:\d+(?:[.,]\d+)?)\)$|^\(\*[\d.,]+\)$/;
const BLOCK_END = /^(übertrag|uebertrag|zwischensumme|gesamt:)/i;
const NUMERIC_ONLY = /^[\d.,]+$/;

type MergedFields = Partial<Record<ColumnRole, string>>;

function regionWithFixedColumns(
  region: TableRegion,
): Pick<TableRegion, "boundaries" | "columnMap" | "dataStartIndex" | "dataEndIndex"> {
  if (region.columnMap.position !== undefined && region.boundaries.length >= 4) {
    return {
      dataStartIndex: region.dataStartIndex,
      dataEndIndex: region.dataEndIndex,
      boundaries: region.boundaries,
      columnMap: region.columnMap,
    };
  }
  return {
    dataStartIndex: region.dataStartIndex,
    dataEndIndex: region.dataEndIndex,
    boundaries: FIXED_BOUNDARIES,
    columnMap: FIXED_COLUMN_MAP,
  };
}

function findKoelnspergerTableRegion(page: PdfPageStructured): TableRegion | null {
  const fromHeader = findTableRegion(page);
  if (fromHeader) return fromHeader;

  const fromContinuation = findTableRegionOrContinuation(page);
  if (fromContinuation) {
    return {
      ...fromContinuation,
      boundaries:
        fromContinuation.boundaries.length >= 4
          ? fromContinuation.boundaries
          : FIXED_BOUNDARIES,
      columnMap:
        fromContinuation.columnMap.position !== undefined
          ? fromContinuation.columnMap
          : FIXED_COLUMN_MAP,
    };
  }

  const lines = page.lines;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]!.text.trim();
    if (!KOELNSPERGER_POSITION_RE.test(text)) continue;
    const probe = {
      dataStartIndex: i,
      dataEndIndex: lines.length,
      boundaries: FIXED_BOUNDARIES,
      columnMap: FIXED_COLUMN_MAP,
    };
    if (hasKoelnspergerArticleNearAnchor(lines, i, probe)) {
      return {
        headerStart: -1,
        headerEnd: -1,
        ...probe,
      };
    }
  }
  return null;
}

function stripCurrency(s: string): string {
  return s.replace(/\s*EUR\b/gi, "").replace(/€/g, "").trim();
}

function normalizePosition(pos: string): string | null {
  const t = pos.trim();
  if (!KOELNSPERGER_POSITION_RE.test(t)) return null;
  return t.replace(/\.$/, "");
}

function parseKoelnspergerPriceNote(text: string): number | null {
  const t = text.trim();
  const perThousand = /^\(\/(\d+(?:[.,]\d+)?)\)$/.exec(t);
  if (perThousand) return parseDeNumber(perThousand[1]!) ?? null;
  const multiplier = /^\(\*([\d.,]+)\)$/.exec(t);
  if (multiplier) return parseDeNumber(multiplier[1]!) ?? null;
  return null;
}

function mergeLineFields(merged: MergedFields, line: PdfLine): RowCells {
  const cells = trimCells(lineToCells(line, COL_WINDOWS, COL_CATCH_ALL));
  const text = line.text.trim();

  if (KOELNSPERGER_POSITION_RE.test(text)) {
    merged.position = text;
  }
  if (cells.position?.trim()) merged.position = cells.position.trim();

  for (const w of line.words) {
    const art = w.text.trim();
    if (looksLikeKoelnspergerArticle(art)) merged.article = art;
  }

  for (const role of ["article", "quantity", "unit", "unitPrice", "lineTotal"] as ColumnRole[]) {
    const val = cells[role]?.trim();
    if (!val || RABATT_LINE.test(val)) continue;
    if (role === "unitPrice") {
      merged.unitPrice = val;
    } else {
      merged[role] = val;
    }
  }

  return cells;
}

function rowFromMerged(merged: MergedFields): Omit<LineItem, "description"> | null {
  const position = normalizePosition(merged.position ?? "");
  const article_number = looksLikeKoelnspergerArticle(merged.article ?? "")
    ? merged.article!.trim()
    : null;

  const quantity = parseDeNumber(stripCurrency(merged.quantity ?? ""));
  const unit_price = parseDeNumber(stripCurrency(merged.unitPrice ?? ""));
  const line_total = parseDeNumber(stripCurrency(merged.lineTotal ?? ""));

  const hasNumeric = quantity !== null || unit_price !== null || line_total !== null;
  if (!hasNumeric || !article_number) return null;

  let unit: string | null = merged.unit?.trim() || null;
  if (unit && unit.length > 12) unit = null;

  return {
    position: position ?? null,
    article_number,
    artikel_prefix: null,
    quantity,
    unit,
    unit_price,
    line_total,
  };
}

function collectPreambleDescription(
  lines: PdfLine[],
  start: number,
  region: Pick<TableRegion, "dataStartIndex">,
): string[] {
  const parts: string[] = [];
  const minIdx = Math.max(region.dataStartIndex, start - 4);
  for (let i = start - 1; i >= minIdx; i--) {
    const line = lines[i]!;
    const text = line.text.trim();
    if (!text || SKIP_LINE.test(text) || BLOCK_END.test(text)) break;
    if (KOELNSPERGER_POSITION_RE.test(text)) break;
    if (NUMERIC_ONLY.test(text) || RABATT_LINE.test(text) || PRICE_NOTE.test(text)) break;

    const cells = trimCells(lineToCells(line, COL_WINDOWS, COL_CATCH_ALL));
    const desc = cells.description?.trim();
    if (desc && !NUMERIC_ONLY.test(desc)) {
      parts.unshift(desc);
      continue;
    }
    if (
      !looksLikeKoelnspergerArticle(text) &&
      !UNIT_ONLY.test(text) &&
      !KOELNSPERGER_POSITION_RE.test(text) &&
      /[A-Za-zÄÖÜäöüß]/.test(text)
    ) {
      parts.unshift(text);
    }
  }
  return parts;
}

function parseKoelnspergerBlock(
  lines: PdfLine[],
  start: number,
  end: number,
  region: Pick<TableRegion, "dataStartIndex">,
): LineItem | null {
  const merged: MergedFields = {};
  const descParts = collectPreambleDescription(lines, start, region);
  let pricePer: number | null = null;

  for (let i = start; i < end; i++) {
    const line = lines[i]!;
    const text = line.text.trim();
    if (!text) continue;
    if (BLOCK_END.test(text)) break;
    if (isNonItemLine(line, 842)) continue;
    if (SKIP_LINE.test(text)) continue;
    if (RABATT_LINE.test(text)) continue;

    const noteFactor = parseKoelnspergerPriceNote(text);
    if (noteFactor !== null) {
      pricePer = noteFactor;
      continue;
    }

    const cells = mergeLineFields(merged, line);

    const desc = cells.description?.trim();
    if (
      desc &&
      !SKIP_LINE.test(desc) &&
      !KOELNSPERGER_POSITION_RE.test(desc) &&
      !looksLikeKoelnspergerArticle(desc) &&
      !NUMERIC_ONLY.test(desc) &&
      !RABATT_LINE.test(desc)
    ) {
      if (!descParts.includes(desc)) descParts.push(desc);
    }
  }

  let parsed = rowFromMerged(merged);
  if (!parsed) {
    for (let i = start; i < end; i++) {
      const cells = trimCells(lineToCells(lines[i]!, COL_WINDOWS, COL_CATCH_ALL));
      if (looksLikeKoelnspergerArticle(cells.article ?? "")) {
        merged.article = cells.article!.trim();
        break;
      }
    }
    parsed = rowFromMerged(merged);
  }
  if (!parsed) return null;

  if (!parsed.position) {
    for (let i = start; i < end; i++) {
      const pos = normalizePosition(lines[i]!.text.trim());
      if (pos) {
        parsed.position = pos;
        break;
      }
    }
  }

  if (!parsed.unit) {
    for (let i = start; i < end; i++) {
      const unitMatch = UNIT_ONLY.exec(lines[i]!.text.trim());
      if (unitMatch?.groups?.u) {
        parsed.unit = unitMatch.groups.u;
        break;
      }
    }
  }

  const item: LineItem = {
    ...parsed,
    description: descParts.join("\n").trim(),
  };
  if (pricePer !== null) item.price_per = pricePer;
  return item;
}

function extractKoelnspergerFromPage(page: PdfPageStructured): LineItem[] {
  const region = findKoelnspergerTableRegion(page);
  if (!region) return [];

  const tableCtx =
    region.headerStart >= 0 ? region : regionWithFixedColumns(region);
  let anchors = findKoelnspergerPositionAnchors(page.lines, tableCtx);
  if (anchors.length === 0) return [];

  const dataEndIndex = findGenericTableEndIndex(page, region, anchors);
  const effectiveRegion = { dataStartIndex: region.dataStartIndex, dataEndIndex };
  anchors = anchors.filter((i) => i < dataEndIndex);
  if (anchors.length === 0) return [];

  const items: LineItem[] = [];
  for (let a = 0; a < anchors.length; a++) {
    const start = anchors[a]!;
    const end = a + 1 < anchors.length ? anchors[a + 1]! : dataEndIndex;
    const item = parseKoelnspergerBlock(page.lines, start, end, effectiveRegion);
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

export function extractKoelnspergerItems(structured: PdfStructured): { items: LineItem[] } {
  const items: LineItem[] = [];
  for (const page of structured.pages) {
    items.push(...extractKoelnspergerFromPage(page));
  }
  return { items: dedupeLineItems(items) };
}

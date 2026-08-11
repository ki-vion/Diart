import type { LineItem } from "../models";
import { parseDeNumber } from "../utils";
import { lineToCells, trimCells } from "../pipeline/columns";
import type { ColumnRole } from "./header-map";
import {
  findEconFloorPositionAnchors,
  hasEconFloorRowSignal,
  isEconFloorPositionAnchor,
  looksLikeEconFloorArticle,
  ECON_FLOOR_POSITION_RE,
} from "./econ-floor-anchors";
import { isNonItemLine, isPostTableText } from "./table-zone";
import type { PdfLine, PdfPageStructured, PdfStructured } from "../../pdf/types";
import { ECON_FLOOR_TEMPLATE } from "../pipeline/templates";

const COL_WINDOWS = ECON_FLOOR_TEMPLATE.defaultWindows;
const COL_CATCH_ALL = ECON_FLOOR_TEMPLATE.descriptionCatchAllMaxX ?? 210;

const SKIP_LINE = ECON_FLOOR_TEMPLATE.skipLine!;
const BLOCK_END =
  /^(including:|total:|total amout|total amount|say total|total value)/i;
const VAT_ONLY = /^\d{1,2}%$/;
const QTY_UNIT =
  /^(?<qty>[\d.,]+)\s*(?<unit>m2|m²|szt|st|pcs|pc|stk|stk\.|m)?$/i;
const HAS_LETTERS = /[A-Za-zÄÖÜäöüß]/;

type MergedFields = Partial<Record<ColumnRole, string>> & { box?: string };

function appendNumericFragment(prev: string | undefined, next: string): string {
  const p = (prev ?? "").trim();
  const n = next.trim();
  if (!n) return p;
  if (!p) return n;
  if (/^[\d\s.,]+$/.test(p) && /^[\d\s.,]+$/.test(n)) {
    return `${p}${n}`.replace(/\s+/g, " ").trim();
  }
  return n;
}

function mergeLineFields(merged: MergedFields, line: PdfLine): void {
  const cells = trimCells(lineToCells(line, COL_WINDOWS, COL_CATCH_ALL));
  const text = line.text.trim();

  if (ECON_FLOOR_POSITION_RE.test(text)) {
    merged.position ??= text;
  }
  if (cells.position?.trim()) merged.position = cells.position.trim();

  if (looksLikeEconFloorArticle(text)) {
    merged.article = text.trim();
  }
  if (cells.article?.trim() && looksLikeEconFloorArticle(cells.article)) {
    merged.article = cells.article.trim();
  }

  // Qty/UOM band: read words once (lineToCells misses "szt" and can double-count)
  let sawQtyBand = false;
  for (const w of line.words) {
    if (w.x < 250 || w.x > 320) continue;
    sawQtyBand = true;
    const t = w.text.trim();
    if (/^(m2|m²|szt|st|pcs|pc|stk|stk\.|m)$/i.test(t)) {
      merged.unit = t;
    } else if (/^[\d.,]+$/.test(t)) {
      merged.quantity = appendNumericFragment(merged.quantity, t);
    }
  }
  if (!sawQtyBand && cells.quantity?.trim()) {
    const parsed = QTY_UNIT.exec(cells.quantity.trim());
    if (parsed?.groups?.qty) {
      merged.quantity = appendNumericFragment(merged.quantity, parsed.groups.qty);
      if (parsed.groups.unit) merged.unit ??= parsed.groups.unit;
    } else {
      merged.quantity = appendNumericFragment(merged.quantity, cells.quantity);
    }
  }

  if (cells.unitPrice?.trim() && !VAT_ONLY.test(cells.unitPrice)) {
    merged.unitPrice = appendNumericFragment(merged.unitPrice, cells.unitPrice);
  }
  if (cells.lineTotal?.trim() && !VAT_ONLY.test(cells.lineTotal)) {
    merged.lineTotal = appendNumericFragment(merged.lineTotal, cells.lineTotal);
  }
}

function parseQtyUnit(raw: string): { quantity: number | null; unit: string | null } {
  const t = raw.trim();
  const m = QTY_UNIT.exec(t);
  if (m?.groups?.qty) {
    return {
      quantity: parseDeNumber(m.groups.qty),
      unit: m.groups.unit?.trim() || null,
    };
  }
  return { quantity: parseDeNumber(t), unit: null };
}

function rowFromMerged(merged: MergedFields): Omit<LineItem, "description"> | null {
  const position = (merged.position ?? "").trim() || null;
  const article_number = merged.article?.trim() || null;

  const qtyParsed = parseQtyUnit(merged.quantity ?? "");
  const quantity = qtyParsed.quantity;
  let unit = merged.unit?.trim() || qtyParsed.unit;
  if (unit && unit.length > 12) unit = null;

  const unit_price = parseDeNumber(merged.unitPrice ?? "");
  const line_total = parseDeNumber(merged.lineTotal ?? "");

  const hasNumeric = quantity !== null || unit_price !== null || line_total !== null;
  if (!hasNumeric) return null;
  if (!article_number && !(merged as { hasServiceName?: boolean }).hasServiceName) {
    // allow rows with description-only identity (Transport)
  }

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

function isDescriptionLine(line: PdfLine): string | null {
  const text = line.text.trim();
  if (!text || SKIP_LINE.test(text) || BLOCK_END.test(text)) return null;
  if (ECON_FLOOR_POSITION_RE.test(text) && isEconFloorPositionAnchor(line)) return null;
  if (looksLikeEconFloorArticle(text)) return null;
  if (VAT_ONLY.test(text)) return null;
  if (/^[\d\s.,]+$/.test(text)) return null;

  const cells = trimCells(lineToCells(line, COL_WINDOWS, COL_CATCH_ALL));
  if (cells.quantity || cells.unitPrice || cells.lineTotal) {
    const desc = cells.description?.trim();
    if (desc && HAS_LETTERS.test(desc)) return desc;
    return null;
  }

  const desc = (cells.description ?? cells.article ?? text).trim();
  if (!desc || !HAS_LETTERS.test(desc)) return null;
  if (/^\[EUR\]$/i.test(desc)) return null;
  return desc;
}

function findDataStart(lines: PdfLine[]): number {
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.text.trim();
    if (/^No\.?$/i.test(t) || /^Item\/Service/i.test(t) || /^Quantity\b/i.test(t)) {
      headerIdx = i;
    }
  }
  if (headerIdx >= 0) {
    let j = headerIdx + 1;
    while (
      j < lines.length &&
      (/^\[EUR\]$/i.test(lines[j]!.text.trim()) ||
        !lines[j]!.text.trim() ||
        SKIP_LINE.test(lines[j]!.text.trim()))
    ) {
      j += 1;
    }
    return j;
  }
  for (let i = 0; i < lines.length; i++) {
    if (
      isEconFloorPositionAnchor(lines[i]!) &&
      findEconFloorPositionAnchors(lines, i, lines.length).length
    ) {
      return i;
    }
  }
  return 0;
}

function findDataEnd(lines: PdfLine[], dataStart: number): number {
  for (let i = dataStart; i < lines.length; i++) {
    const t = lines[i]!.text.trim();
    if (!t) continue;
    if (BLOCK_END.test(t) || isPostTableText(t)) return i;
    if (isNonItemLine(lines[i]!, 842) && i > dataStart + 2) return i;
  }
  return lines.length;
}

function parseEconFloorBlock(
  lines: PdfLine[],
  start: number,
  end: number,
): LineItem | null {
  const merged: MergedFields & { hasServiceName?: boolean } = {};
  const descParts: string[] = [];

  for (let i = start; i < end; i++) {
    const line = lines[i]!;
    const text = line.text.trim();
    if (!text || SKIP_LINE.test(text)) continue;
    if (BLOCK_END.test(text)) break;
    if (isNonItemLine(line, 842)) continue;
    if (VAT_ONLY.test(text)) continue;

    mergeLineFields(merged, line);

    const desc = isDescriptionLine(line);
    if (desc) {
      if (!looksLikeEconFloorArticle(desc)) {
        merged.hasServiceName = true;
        if (!descParts.includes(desc)) descParts.push(desc);
      }
    }
  }

  // Service-only rows (Transport): first non-pos letter token in desc band becomes description
  if (!merged.article && descParts.length === 0) {
    for (let i = start; i < end; i++) {
      const cells = trimCells(lineToCells(lines[i]!, COL_WINDOWS, COL_CATCH_ALL));
      const candidate = (cells.description ?? cells.article ?? lines[i]!.text).trim();
      if (
        candidate &&
        HAS_LETTERS.test(candidate) &&
        !ECON_FLOOR_POSITION_RE.test(candidate) &&
        !VAT_ONLY.test(candidate)
      ) {
        descParts.push(candidate);
        merged.hasServiceName = true;
        break;
      }
    }
  }

  // MuPDF often splits "m2" into word "m" + orphan glyph "2" (asText still shows m2)
  if (/^m$/i.test(merged.unit ?? "")) {
    for (let i = start; i < end; i++) {
      const line = lines[i]!;
      if (line.text.trim() !== "2") continue;
      // Real position anchors have same-Y article/billing; superscript "2" does not
      if (isEconFloorPositionAnchor(line) && hasEconFloorRowSignal(lines, i)) continue;
      merged.unit = "m2";
      break;
    }
  }

  const parsed = rowFromMerged(merged);
  if (!parsed) return null;
  if (!parsed.article_number && !descParts.length) return null;

  return {
    ...parsed,
    description: descParts.join("\n").trim(),
  };
}

function extractFromPage(page: PdfPageStructured): LineItem[] {
  const lines = page.lines;
  const dataStart = findDataStart(lines);
  const dataEnd = findDataEnd(lines, dataStart);
  const anchors = findEconFloorPositionAnchors(lines, dataStart, dataEnd);
  if (anchors.length === 0) return [];

  const items: LineItem[] = [];
  for (let a = 0; a < anchors.length; a++) {
    const start = anchors[a]!;
    const end = a + 1 < anchors.length ? anchors[a + 1]! : dataEnd;
    const item = parseEconFloorBlock(lines, start, end);
    if (item) items.push(item);
  }
  return items;
}

function dedupeLineItems(items: LineItem[]): LineItem[] {
  const seen = new Set<string>();
  const out: LineItem[] = [];
  for (const it of items) {
    const key = [it.position ?? "", it.article_number ?? "", it.line_total ?? "", it.quantity ?? ""].join(
      "|",
    );
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export function extractEconFloorItems(structured: PdfStructured): { items: LineItem[] } {
  const items: LineItem[] = [];
  for (const page of structured.pages) {
    items.push(...extractFromPage(page));
  }
  return { items: dedupeLineItems(items) };
}

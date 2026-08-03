import type { LineItem } from "../models";
import { parseDeNumber } from "../utils";
import type { PdfLine, PdfPageStructured, PdfStructured } from "../../pdf/types";
import type { ColumnRole } from "./header-map";
import {
  ECON_FLOOR_ARTICLE_RE,
  ECON_FLOOR_WINDOWS,
  econFloorCellsFromLine,
  findEconFloorHeaderIndex,
  isEconFloorTableEnd,
  parseEconFloorPositionCell,
  textInEconFloorWindow,
} from "./econ-floor-anchors";
import { isNonItemLine } from "./table-zone";

const UNIT_ONLY = /^(m2|m²|szt|sz|pcs?|pc)$/i;
const SKIP_DESC = /^(no\.?|item|quantity|uom|box|vat|subtotal)$/i;

function windowFor(role: ColumnRole) {
  return ECON_FLOOR_WINDOWS.find((w) => w.role === role);
}

function stripVat(text: string): string {
  return text.replace(/\s*0\s*%/g, "").trim();
}

function parseBillingNumber(text: string): number | null {
  const cleaned = stripVat(text);
  const direct = parseDeNumber(cleaned);
  if (direct !== null) return direct;
  const m = /[\d.,]+/.exec(cleaned);
  return m ? parseDeNumber(m[0]!) : null;
}

function parseArticleFromLine(line: PdfLine): string | null {
  const artWin = windowFor("article");
  if (!artWin) return null;
  const cell = textInEconFloorWindow(line, artWin);
  const m = ECON_FLOOR_ARTICLE_RE.exec(cell.replace(/\s/g, ""));
  return m ? m[0]! : null;
}

function isPositionAnchorLine(line: PdfLine): boolean {
  const posWin = windowFor("position");
  if (!posWin) return false;
  const cell = textInEconFloorWindow(line, posWin);
  if (parseEconFloorPositionCell(cell)) return true;
  const merged = line.text.trim().replace(/\s/g, "");
  return /^(\d{1,3})\.(\d{5,8})$/.test(merged);
}

function findPositionAnchors(lines: PdfLine[], start: number, end: number): number[] {
  const anchors: number[] = [];
  for (let i = start; i < end; i++) {
    const line = lines[i]!;
    if (!line.text.trim()) continue;
    if (isEconFloorTableEnd(line.text)) break;
    if (isPositionAnchorLine(line)) anchors.push(i);
  }
  return anchors;
}

function findTableEndIndex(lines: PdfLine[], start: number): number {
  for (let i = start; i < lines.length; i++) {
    if (isEconFloorTableEnd(lines[i]!.text)) return i;
  }
  return lines.length;
}

function lineHasEconFloorBilling(line: PdfLine): boolean {
  const priceWin = windowFor("unitPrice");
  const totalWin = windowFor("lineTotal");
  if (!priceWin || !totalWin) return false;
  const price = textInEconFloorWindow(line, priceWin);
  const total = textInEconFloorWindow(line, totalWin);
  return parseBillingNumber(price) !== null || parseBillingNumber(total) !== null;
}

function mergeBillingCells(
  line: PdfLine,
  merged: Partial<Record<ColumnRole, string>>,
  force = false,
): void {
  if (!force && !lineHasEconFloorBilling(line)) return;
  const cells = econFloorCellsFromLine(line);
  for (const role of ["quantity", "unit", "unitPrice", "lineTotal"] as const) {
    const val = stripVat(cells[role] ?? "");
    if (val) merged[role] = val;
  }
}

function parseEconFloorBlock(
  lines: PdfLine[],
  start: number,
  end: number,
): LineItem | null {
  const merged: Partial<Record<ColumnRole, string>> = {};
  const descParts: string[] = [];

  const anchorLine = lines[start]!;
  const posWin = windowFor("position")!;
  const posCell = textInEconFloorWindow(anchorLine, posWin);
  const parsed = parseEconFloorPositionCell(posCell);
  if (!parsed) return null;

  let article = parsed.article;
  if (!article) {
    article = parseArticleFromLine(anchorLine);
  }

  mergeBillingCells(anchorLine, merged, true);

  const anchorDesc = textInEconFloorWindow(anchorLine, windowFor("description")!);
  if (
    anchorDesc &&
    !SKIP_DESC.test(anchorDesc) &&
    !parseEconFloorPositionCell(anchorDesc) &&
    !ECON_FLOOR_ARTICLE_RE.test(anchorDesc.replace(/\s/g, ""))
  ) {
    descParts.push(anchorDesc);
  }

  for (let i = start + 1; i < end; i++) {
    const line = lines[i]!;
    const text = line.text.trim();
    if (!text || SKIP_DESC.test(text)) continue;
    if (isNonItemLine(line, 842)) continue;
    if (isEconFloorTableEnd(text)) break;

    if (isPositionAnchorLine(line)) break;

    mergeBillingCells(line, merged);

    if (!article) {
      const art = parseArticleFromLine(line);
      if (art) article = art;
    }

    const descWin = windowFor("description")!;
    const desc = textInEconFloorWindow(line, descWin);
    if (
      desc &&
      !SKIP_DESC.test(desc) &&
      !/^[,.\-–—]+$/.test(desc.trim()) &&
      !parseEconFloorPositionCell(desc) &&
      !ECON_FLOOR_ARTICLE_RE.test(desc.replace(/\s/g, "")) &&
      !UNIT_ONLY.test(desc)
    ) {
      if (!descParts.includes(desc)) descParts.push(desc);
    }
  }

  const quantity = parseBillingNumber(merged.quantity ?? "");
  const unit_price = parseBillingNumber(merged.unitPrice ?? "");
  const line_total = parseBillingNumber(merged.lineTotal ?? "");
  const hasNumeric = quantity !== null || unit_price !== null || line_total !== null;
  if (!hasNumeric) return null;

  let unit: string | null = (merged.unit ?? "").trim() || null;
  if (unit && unit.length > 8) unit = null;

  return {
    position: parsed.position,
    article_number: article,
    artikel_prefix: null,
    description: descParts.join("\n").trim(),
    quantity,
    unit,
    unit_price,
    line_total,
  };
}

function extractFromPage(page: PdfPageStructured): LineItem[] {
  const headerIdx = findEconFloorHeaderIndex(page.lines);
  if (headerIdx < 0) return [];

  const dataStart = headerIdx + 1;
  const dataEnd = findTableEndIndex(page.lines, dataStart);
  const anchors = findPositionAnchors(page.lines, dataStart, dataEnd);
  if (anchors.length === 0) return [];

  const items: LineItem[] = [];
  for (let a = 0; a < anchors.length; a++) {
    const start = anchors[a]!;
    const end = a + 1 < anchors.length ? anchors[a + 1]! : dataEnd;
    const item = parseEconFloorBlock(page.lines, start, end);
    if (item) items.push(item);
  }
  return items;
}

export function extractEconFloorItems(structured: PdfStructured): { items: LineItem[] } {
  const items: LineItem[] = [];
  for (const page of structured.pages) {
    items.push(...extractFromPage(page));
  }
  return { items };
}

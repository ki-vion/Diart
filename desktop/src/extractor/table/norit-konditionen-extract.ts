import type { LineItem } from "../models";
import { parseDeNumber } from "../utils";
import type { PdfLine, PdfStructured } from "../../pdf/types";
import { isNonItemLine } from "./table-zone";

const ART_RE = /^\d{5,6}$/;
const PRICE_RE = /^(?<price>[\d.,]+)\s+EUR\/(?<unit>\S+)/i;
/** Row that opens a table: „Teilenr. | Teilebezeichnung | Nettopreis …“ or „Dienstleistung | Nettopreis“. */
const TABLE_HEADER_RE = /^(Teilenr\.|Dienstleistung)$/i;
const PRICE_HEADER_RE = /^Nettopreis\b/i;
/** Sub-header row below „Nettopreis“: „ab 5 t | ab 12 t | ab 24 t | bei Abholung“. */
const TIER_HEADER_RE = /^(ab \d+ t|bei Abholung)$/i;
/** Pickup prices are a different delivery condition and never used. */
const EXCLUDED_COLUMN_RE = /Abholung/i;
/** Price lists carry no quantity — every row is exported with Menge 1. */
const DEFAULT_QUANTITY = 1;

const DESC_MAX_X = 260;
const PRICE_MIN_X = 250;
const ART_MAX_X = 95;
const Y_TOL = 1.5;
/** Average glyph width relative to font size, used to estimate text centers. */
const GLYPH_WIDTH_EM = 0.5;

type PriceColumn = { label: string; center: number };
type PricedCell = { price: number; unit: string; center: number };

function lineXMin(line: PdfLine): number {
  const xs = line.words.map((w) => w.x);
  return xs.length ? Math.min(...xs) : 0;
}

/** Estimated horizontal center (MuPDF words carry no width). */
function lineCenter(line: PdfLine): number {
  const last = line.words.reduce<PdfLine["words"][number] | null>(
    (acc, w) => (acc === null || w.x > acc.x ? w : acc),
    null,
  );
  const start = lineXMin(line);
  if (!last) return start;
  const end = last.x + last.text.length * last.fontSize * GLYPH_WIDTH_EM;
  return (start + end) / 2;
}

function groupLinesByY(lines: PdfLine[]): PdfLine[][] {
  const groups: PdfLine[][] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last[0]!.y - line.y) <= Y_TOL) {
      last.push(line);
    } else {
      groups.push([line]);
    }
  }
  return groups;
}

function parsePrice(text: string): { price: number; unit: string } | null {
  const m = PRICE_RE.exec(text.trim());
  if (!m?.groups) return null;
  const price = parseDeNumber(m.groups.price ?? "");
  if (price === null) return null;
  return { price, unit: m.groups.unit ?? "" };
}

function toColumns(lines: PdfLine[]): PriceColumn[] {
  return lines
    .map((l) => ({ label: l.text.trim(), center: lineCenter(l) }))
    .sort((a, b) => a.center - b.center);
}

function nearestColumn(columns: PriceColumn[], center: number): PriceColumn | null {
  let best: PriceColumn | null = null;
  for (const col of columns) {
    if (!best || Math.abs(col.center - center) < Math.abs(best.center - center)) {
      best = col;
    }
  }
  return best;
}

/**
 * Leftmost filled price column (ab 5 t → ab 12 t → ab 24 t …), never „bei Abholung“.
 * Without known header columns, the leftmost price cell is used.
 */
function pickPrice(columns: PriceColumn[], cells: PricedCell[]): PricedCell | null {
  const sorted = [...cells].sort((a, b) => a.center - b.center);
  if (columns.length === 0) return sorted[0] ?? null;
  return (
    sorted.find((cell) => {
      const col = nearestColumn(columns, cell.center);
      return col !== null && !EXCLUDED_COLUMN_RE.test(col.label);
    }) ?? null
  );
}

/** Header rows replace the active price columns; returns null for non-header rows. */
function headerColumns(group: PdfLine[]): PriceColumn[] | null {
  const texts = group.map((l) => l.text.trim());
  if (texts.some((t) => TABLE_HEADER_RE.test(t))) {
    return toColumns(group.filter((l) => PRICE_HEADER_RE.test(l.text.trim())));
  }
  if (texts.length > 0 && texts.every((t) => TIER_HEADER_RE.test(t))) {
    return toColumns(group);
  }
  return null;
}

function parseRow(group: PdfLine[], columns: PriceColumn[]): LineItem | null {
  let article: string | null = null;
  const descParts: string[] = [];
  const cells: PricedCell[] = [];

  for (const line of group) {
    const text = line.text.trim();
    const x = lineXMin(line);
    const priced = parsePrice(text);
    if (priced && x >= PRICE_MIN_X) {
      cells.push({ ...priced, center: lineCenter(line) });
    } else if (x < ART_MAX_X && ART_RE.test(text)) {
      article ??= text;
    } else if (x < DESC_MAX_X && /[A-Za-zÄÖÜäöüß]/.test(text)) {
      descParts.push(text);
    }
  }

  if (cells.length === 0 || descParts.length === 0) return null;
  const chosen = pickPrice(columns, cells);
  if (!chosen) return null;

  return {
    position: null,
    article_number: article,
    artikel_prefix: null,
    description: descParts.join(" "),
    quantity: DEFAULT_QUANTITY,
    unit: chosen.unit || null,
    unit_price: chosen.price,
    line_total: chosen.price * DEFAULT_QUANTITY,
  };
}

export function extractNoritKonditionenItems(structured: PdfStructured): LineItem[] {
  const items: LineItem[] = [];
  let columns: PriceColumn[] = [];
  for (const page of structured.pages) {
    const usable = page.lines.filter(
      (l) => l.text.trim() && !isNonItemLine(l, page.height),
    );
    for (const group of groupLinesByY(usable)) {
      const header = headerColumns(group);
      if (header) {
        columns = header;
        continue;
      }
      const item = parseRow(group, columns);
      if (item) items.push(item);
    }
  }
  return items;
}

import type { LineItem, TierPrice } from "../models";
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
const TONNAGE_RE = /^ab \d+ t$/i;
/** Only these PDF columns are exported; „ab 24 t“ and „bei Abholung“ are dropped. */
const KEEP_COLUMN_RE = /^(ab (5|12) t|Nettopreis|Nettopreis frei Haus)$/i;
const SERVICE_SECTION = "Dienstleistung";

const DESC_MAX_X = 260;
const PRICE_MIN_X = 250;
const ART_MAX_X = 95;
const Y_TOL = 1.5;
/** Average glyph width relative to font size, used to estimate text centers. */
const GLYPH_WIDTH_EM = 0.5;

type PriceColumn = { label: string; center: number };
type PricedCell = { price: number; unit: string; center: number };

type TableState = {
  section: string | null;
  columns: PriceColumn[];
  lastTitle: string | null;
};

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
  return lines.map((l) => ({ label: l.text.trim(), center: lineCenter(l) }));
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
 * Map price cells onto header columns. A single tonnage price is a merged
 * cell in the PDF (e.g. Heizrohr) and applies to every „ab N t“ column.
 */
function assignTierPrices(columns: PriceColumn[], cells: PricedCell[]): TierPrice[] {
  const byLabel = new Map<string, number>();
  for (const cell of cells) {
    const col = nearestColumn(columns, cell.center);
    if (col && !byLabel.has(col.label)) byLabel.set(col.label, cell.price);
  }
  const tonnage = columns.filter((c) => TONNAGE_RE.test(c.label));
  const tonnagePrices = tonnage.filter((c) => byLabel.has(c.label));
  if (tonnagePrices.length === 1) {
    const merged = byLabel.get(tonnagePrices[0]!.label)!;
    for (const c of tonnage) byLabel.set(c.label, merged);
  }
  return columns
    .filter((c) => KEEP_COLUMN_RE.test(c.label) && byLabel.has(c.label))
    .map((c) => ({ label: c.label, price: byLabel.get(c.label)! }));
}

/** Header rows update the table state; returns true when the group was a header. */
function applyHeaderRow(group: PdfLine[], state: TableState): boolean {
  const texts = group.map((l) => l.text.trim());
  const opener = texts.find((t) => TABLE_HEADER_RE.test(t));
  if (opener) {
    state.section = /^Dienstleistung$/i.test(opener) ? SERVICE_SECTION : state.lastTitle;
    state.columns = toColumns(group.filter((l) => PRICE_HEADER_RE.test(l.text.trim())));
    return true;
  }
  if (texts.length > 0 && texts.every((t) => TIER_HEADER_RE.test(t))) {
    state.columns = toColumns(group);
    return true;
  }
  return false;
}

function parseRow(group: PdfLine[], state: TableState): LineItem | null {
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

  if (cells.length === 0 || descParts.length === 0) {
    if (group.length === 1 && descParts.length === 1) state.lastTitle = descParts[0]!;
    return null;
  }

  cells.sort((a, b) => a.center - b.center);
  const tiers =
    state.columns.length > 0
      ? assignTierPrices(state.columns, cells)
      : [{ label: "Nettopreis", price: cells[0]!.price }];
  const first = tiers[0];
  if (!first) return null;

  return {
    position: null,
    article_number: article,
    artikel_prefix: null,
    description: descParts.join(" "),
    quantity: null,
    unit: cells[0]!.unit || null,
    unit_price: first.price,
    line_total: null,
    section: state.section,
    tier_prices: tiers,
  };
}

export function extractNoritKonditionenItems(structured: PdfStructured): LineItem[] {
  const items: LineItem[] = [];
  const state: TableState = { section: null, columns: [], lastTitle: null };
  for (const page of structured.pages) {
    const usable = page.lines.filter(
      (l) => l.text.trim() && !isNonItemLine(l, page.height),
    );
    for (const group of groupLinesByY(usable)) {
      if (applyHeaderRow(group, state)) continue;
      const item = parseRow(group, state);
      if (item) items.push(item);
    }
  }
  return items;
}

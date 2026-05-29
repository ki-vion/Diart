import type { LineItem } from "../models";
import { parseDeNumber } from "../utils";
import type { PdfLine } from "../../pdf/types";
import {
  clusterLineIntoCells,
  inferColumnBoundaries,
  type WordToken,
} from "./cluster-columns";
import { HEADER_HINTS, type ColumnRole, type TableColumnMap } from "./header-map";

const RK_HEAD = /^(?<pos>\d{5})\s+(?<art>\d{6,})\b/;
const KAN_HEAD = /^(?<pos>\d{3})\s+Artikelnummer:\s+(?<art>\S+)/i;
const NORIT_POS = /^\d{3}$/;
const NORIT_NET = /^(?<net>[\d.,]+)\s+EUR\s*$/i;
const LAIER_ART = /^\d{8}$/;

const QTY_ONLY = /^[\d.,]+$/;
const QTY_UNIT_LINE =
  /^(?<qty>[\d.,]+)\s+(?<unit>.+)$/i;
const UNIT_ONLY =
  /^(?<u>ST|M2|SA|St|Stück|Stk|kg|l|m²|m2|qm|Pal\.?|Karton)$/i;
const UNIT_PRICE_LINE =
  /^(?<price>[\d.,]+)\s+EUR\s*\/\s*(?<per>.+)$/i;
const PRICE_ONLY = /^[\d.,]+$/;
const EUR_PER = /EUR\s*\/\s*1/i;

const SKIP_LINE =
  /^(<b>|pos\.|übertrag|seite\s+\d|angbot|kunden|in eur$|abw\.|zolltarif|produkt|coc-|länge:|breite:|charge:|vpe:|abmessung:|artikelnummer:|bestell)/i;

export type BlockAnchorKind = "rk" | "kan" | "norit" | "laier";

export type BlockAnchor = {
  lineIndex: number;
  kind: BlockAnchorKind;
};

export function scoreHeaderLine(text: string): number {
  const norm = text.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
  let score = 0;
  for (const hints of Object.values(HEADER_HINTS)) {
    for (const h of hints) {
      const token = h.replace(/\./g, "");
      if (norm.includes(token)) score += 1;
    }
  }
  return score;
}

function isLaierAnchor(lines: PdfLine[], i: number): boolean {
  const art = lines[i]?.text.trim() ?? "";
  if (!LAIER_ART.test(art)) return false;
  if (i + 4 >= lines.length) return false;
  const afterArt = lines[i + 1]?.text.trim() ?? "";
  if (/artikelnummer|zolltarif|abmessung|produkt\s+zert/i.test(afterArt)) return false;
  const qty = lines[i + 2]?.text.trim() ?? "";
  const p3 = lines[i + 3]?.text.trim() ?? "";
  const p4 = lines[i + 4]?.text.trim() ?? "";
  return (
    (QTY_UNIT_LINE.test(qty) || PRICE_ONLY.test(qty)) &&
    PRICE_ONLY.test(p3) &&
    PRICE_ONLY.test(p4)
  );
}

function isNoritAnchor(lines: PdfLine[], i: number): boolean {
  const t = lines[i]?.text.trim() ?? "";
  if (!NORIT_POS.test(t)) return false;
  const posNum = Number.parseInt(t, 10);
  if (!Number.isFinite(posNum) || posNum < 1) return false;
  const next = lines[i + 1]?.text.trim() ?? "";
  const prev = lines[i - 1]?.text.trim() ?? "";
  if (NORIT_NET.test(next)) return true;
  return NORIT_QTY.test(prev);
}

export function findBlockAnchors(lines: PdfLine[], fromIndex: number): BlockAnchor[] {
  const anchors: BlockAnchor[] = [];

  for (let i = fromIndex; i < lines.length; i++) {
    const t = lines[i]!.text.trim();
    if (!t || SKIP_LINE.test(t)) continue;

    if (RK_HEAD.test(t)) {
      anchors.push({ lineIndex: i, kind: "rk" });
      continue;
    }
    if (KAN_HEAD.test(t)) {
      anchors.push({ lineIndex: i, kind: "kan" });
      continue;
    }
    if (isLaierAnchor(lines, i)) {
      anchors.push({ lineIndex: i, kind: "laier" });
      continue;
    }
    if (isNoritAnchor(lines, i)) {
      anchors.push({ lineIndex: i, kind: "norit" });
    }
  }

  return anchors;
}

function shouldSkipBlockLine(t: string): boolean {
  if (!t) return true;
  if (SKIP_LINE.test(t)) return true;
  if (t === "<B>") return true;
  if (scoreHeaderLine(t) >= 2) return true;
  return false;
}

const NORIT_QTY = /^(?<qty>[\d.,]+)\s+(?<unit>m²|m2|St|kg|l|qm)\s*$/i;
const NORIT_ART = /^\d{8}$/;

function parseLaierBlock(texts: string[]): LineItem | null {
  const article_number = texts[0] ?? null;
  if (texts.length < 4) return null;

  const description = texts[1] ?? "";
  const qtyLine = texts[2] ?? "";
  const priceLine = texts[3] ?? "";
  const totalLine = texts[4] ?? "";

  const qtyMatch = QTY_UNIT_LINE.exec(qtyLine);
  const quantity = qtyMatch ? parseDeNumber(qtyMatch.groups?.qty ?? "") : parseDeNumber(qtyLine);
  const unit = qtyMatch?.groups?.unit?.trim() ?? null;
  const unit_price = parseDeNumber(priceLine);
  const line_total = parseDeNumber(totalLine);

  if (quantity === null && unit_price === null) return null;

  return {
    position: null,
    article_number,
    description,
    quantity,
    unit,
    unit_price,
    line_total,
  };
}

function parseNoritBlock(texts: string[], lines: PdfLine[]): LineItem | null {
  const position = texts[0] ?? null;
  let line_total: number | null = null;
  let quantity: number | null = null;
  let unit: string | null = null;
  let unit_price: number | null = null;
  let article_number: string | null = null;
  const descParts: string[] = [];

  if (texts.length > 1 && NORIT_NET.test(texts[1] ?? "")) {
    const m = NORIT_NET.exec(texts[1] ?? "");
    line_total = parseDeNumber(m?.groups?.net ?? "");
  }

  for (let i = 1; i < texts.length; i++) {
    const t = texts[i]!;
    if (shouldSkipBlockLine(t)) continue;

    const net = NORIT_NET.exec(t);
    if (net?.groups) {
      line_total = parseDeNumber(net.groups.net ?? "");
      continue;
    }

    const qty = NORIT_QTY.exec(t);
    if (qty?.groups) {
      quantity = parseDeNumber(qty.groups.qty ?? "");
      unit = qty.groups.unit ?? null;
      continue;
    }

    const up = UNIT_PRICE_LINE.exec(t);
    if (up?.groups) {
      unit_price = parseDeNumber(up.groups.price ?? "");
      continue;
    }

    if (NORIT_ART.test(t)) {
      article_number = t;
      continue;
    }

    if (PRICE_ONLY.test(t)) continue;
    if (t.endsWith("EUR")) continue;

    descParts.push(t);
  }

  void lines;

  if (line_total === null && quantity === null && unit_price === null) return null;
  if (line_total === null && unit_price === null) return null;

  return {
    position,
    article_number,
    description: descParts.join(" ").trim(),
    quantity,
    unit,
    unit_price,
    line_total,
  };
}

/** Parse stacked lines between two position anchors (RK, KAN, Norit, Laier). */
export function parseItemBlock(
  lines: PdfLine[],
  boundaries: number[],
  columnMap: TableColumnMap,
): LineItem | null {
  const texts = lines.map((l) => l.text.trim()).filter(Boolean);
  if (texts.length === 0) return null;

  let position: string | null = null;
  let article_number: string | null = null;
  let startIdx = 0;

  const rk = RK_HEAD.exec(texts[0] ?? "");
  if (rk?.groups) {
    position = rk.groups.pos ?? null;
    article_number = rk.groups.art ?? null;
    startIdx = 1;
  }

  const kan = KAN_HEAD.exec(texts[0] ?? "");
  if (kan?.groups) {
    position = kan.groups.pos ?? null;
    article_number = kan.groups.art ?? null;
    startIdx = 1;
  }

  if (NORIT_POS.test(texts[0] ?? "")) {
    return parseNoritBlock(texts, lines);
  }

  if (LAIER_ART.test(texts[0] ?? "")) {
    return parseLaierBlock(texts);
  }

  const state = {
    quantity: null as number | null,
    unit: null as string | null,
    unit_price: null as number | null,
    line_total: null as number | null,
  };
  const descParts: string[] = [];
  const priceDecimals: number[] = [];

  for (let i = startIdx; i < texts.length; i++) {
    const t = texts[i]!;
    if (shouldSkipBlockLine(t)) continue;

    if (NORIT_NET.test(t)) {
      const m = NORIT_NET.exec(t);
      state.line_total = parseDeNumber(m?.groups?.net ?? "");
      continue;
    }

    const colCells =
      boundaries.length > 0
        ? clusterLineIntoCells(
            lines[i]!.words.map((w) => ({ text: w.text, x: w.x })),
            boundaries,
          )
        : null;

    if (colCells) {
      const fromCols = readFieldsFromCells(colCells, columnMap);
      if (fromCols.quantity !== undefined) state.quantity ??= fromCols.quantity;
      if (fromCols.unit) state.unit ??= fromCols.unit;
      if (fromCols.unit_price !== undefined) state.unit_price ??= fromCols.unit_price;
      if (fromCols.line_total !== undefined) state.line_total ??= fromCols.line_total;
      if (fromCols.description) descParts.push(fromCols.description);
      continue;
    }

    const unitPrice = UNIT_PRICE_LINE.exec(t);
    if (unitPrice?.groups) {
      state.unit_price ??= parseDeNumber(unitPrice.groups.price ?? "");
      continue;
    }

    if (EUR_PER.test(t)) {
      const m = /^([\d.,]+)/.exec(t);
      if (m) state.unit_price ??= parseDeNumber(m[1] ?? "");
      continue;
    }

    const qtyUnit = QTY_UNIT_LINE.exec(t);
    if (qtyUnit?.groups?.qty) {
      state.quantity ??= parseDeNumber(qtyUnit.groups.qty);
      if (qtyUnit.groups.unit) state.unit ??= qtyUnit.groups.unit.trim();
      continue;
    }

    if (UNIT_ONLY.test(t)) {
      state.unit ??= UNIT_ONLY.exec(t)?.groups?.u ?? t;
      continue;
    }

    if (QTY_ONLY.test(t) && state.quantity === null && !t.includes(",")) {
      const q = parseDeNumber(t);
      if (q !== null && q < 100_000) {
        state.quantity = q;
        continue;
      }
    }

    if (PRICE_ONLY.test(t)) {
      const n = parseDeNumber(t);
      if (n !== null && n !== state.quantity) priceDecimals.push(n);
      continue;
    }

    if (t.startsWith("=")) continue;

    if (!RK_HEAD.test(t) && !KAN_HEAD.test(t) && !NORIT_POS.test(t)) {
      descParts.push(t);
    }
  }

  if (priceDecimals.length >= 2) {
    state.unit_price ??= priceDecimals[priceDecimals.length - 2]!;
    state.line_total ??= priceDecimals[priceDecimals.length - 1]!;
  } else if (priceDecimals.length === 1) {
    const n = priceDecimals[0]!;
    if (n >= 500 && state.line_total === null) {
      state.line_total = n;
    } else {
      state.unit_price ??= n;
    }
  }

  const hasValue =
    state.quantity !== null || state.unit_price !== null || state.line_total !== null;
  if (!hasValue) return null;

  return {
    position,
    article_number,
    description: descParts.join(" ").trim(),
    quantity: state.quantity,
    unit: state.unit,
    unit_price: state.unit_price,
    line_total: state.line_total,
  };
}

function readFieldsFromCells(
  cells: string[],
  map: TableColumnMap,
): {
  quantity?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  line_total?: number | null;
  description?: string;
} {
  const out: {
    quantity?: number | null;
    unit?: string | null;
    unit_price?: number | null;
    line_total?: number | null;
    description?: string;
  } = {};

  const pick = (role: ColumnRole) => {
    const idx = map[role];
    if (idx === undefined) return "";
    return (cells[idx] ?? "").trim();
  };

  const qty = parseDeNumber(pick("quantity"));
  if (qty !== null) out.quantity = qty;
  const unit = pick("unit");
  if (unit) out.unit = unit;
  const up = parseDeNumber(pick("unitPrice"));
  if (up !== null) out.unit_price = up;
  const lt = parseDeNumber(pick("lineTotal"));
  if (lt !== null) out.line_total = lt;
  const desc = pick("description");
  if (desc) out.description = desc;

  return out;
}

export function findTableRegion(page: { lines: PdfLine[] }): {
  dataStartIndex: number;
  boundaries: number[];
  columnMap: TableColumnMap;
} | null {
  let headerStart = -1;
  let headerEnd = -1;
  let bestScore = 0;

  for (let i = 0; i < page.lines.length; i++) {
    const score = scoreHeaderLine(page.lines[i]!.text);
    if (score > 0) {
      if (headerStart < 0) headerStart = i;
      headerEnd = i;
      bestScore = Math.max(bestScore, score);
    }
  }

  if (headerStart < 0 || bestScore < 2) return null;

  while (headerEnd + 1 < page.lines.length) {
    const next = page.lines[headerEnd + 1]!.text.trim();
    if (!next) {
      headerEnd += 1;
      continue;
    }
    if (findBlockAnchors(page.lines, headerEnd + 1).some((a) => a.lineIndex === headerEnd + 1)) {
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
    for (const w of page.lines[i]!.words) {
      headerTokens.push({ text: w.text, x: w.x });
    }
  }

  const boundaries = inferColumnBoundaries(headerTokens);
  const headerCells = clusterLineIntoCells(headerTokens, boundaries);
  const columnMap = mapColumnsFromCells(headerCells);

  return {
    dataStartIndex: headerEnd + 1,
    boundaries,
    columnMap,
  };
}

function mapColumnsFromCells(cells: string[]): TableColumnMap {
  const map: TableColumnMap = {};
  cells.forEach((cell, idx) => {
    const norm = cell.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
    if (!norm) return;
    for (const role of Object.keys(HEADER_HINTS) as ColumnRole[]) {
      const hints = HEADER_HINTS[role];
      if (hints.some((h) => norm.includes(h.replace(/\./g, "")))) {
        if (map[role] === undefined) map[role] = idx;
      }
    }
  });
  return map;
}

export function extractBlocksFromPage(
  page: { lines: PdfLine[] },
  region: { dataStartIndex: number; boundaries: number[]; columnMap: TableColumnMap },
): LineItem[] {
  const anchors = findBlockAnchors(page.lines, region.dataStartIndex);
  if (anchors.length === 0) return [];

  const items: LineItem[] = [];
  for (let a = 0; a < anchors.length; a++) {
    const start = anchors[a]!.lineIndex;
    const end = a + 1 < anchors.length ? anchors[a + 1]!.lineIndex : page.lines.length;
    const blockLines = page.lines.slice(start, end);
    const item = parseItemBlock(blockLines, region.boundaries, region.columnMap);
    if (item) items.push(item);
  }
  return items;
}

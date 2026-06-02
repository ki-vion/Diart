import type { LineItem } from "../models";
import { parseDeNumber } from "../utils";
import { isRkNonItemText } from "./rk-footer";

const MAX_PLAUSIBLE_PRICE = 999_999;

const RK_HEAD = /^(?<pos>\d{5})\s+(?<art>\d{6,})(?<tail>.*)$/i;

const QTY_UNIT_LINE = /^(?<qty>[\d.,]+)\s+(?<unit>.+)$/i;
const QTY_UNIT_MERGED = /^(?<qty>[\d.,]+)(?<unit>ST|SA|M2|St|Stück|Stk|KG|kg\/Sa)$/i;
const DESC_WITH_TOTAL = /^(?<desc>[^\d=].+?)\s+(?<total>[\d.,]+)$/;
const UNIT_ONLY = /^(?<u>ST|M2|SA|St|Stück|Stk|kg|l|m²|m2|qm)$/i;
const QTY_ONLY = /^[\d.,]+$/;
const PRICE_ONLY = /^[\d.,]+$/;
const UNIT_PRICE_LINE = /^(?<price>[\d.,]+)\s+EUR\s*\/\s*/i;
const EUR_PER = /EUR\s*\/\s*1/i;

const SKIP =
  /^(<b>|pos\.|artikel-nr|menge|me|einzel|pos\.-wert|artikelbezeichnung|in eur|übertrag|seite\s)/i;

/** VPE / Gebinde in der Artikelspalte (z. B. „1 kg/Fl“), nicht Rechnungsmenge. */
const RK_PACKAGING_SPEC =
  /^[\d.,]+\s+(?:kg|g|l|ml|m|meter|st|stk|stück)\s*\/\s*\w+/i;

function isRkPackagingLine(t: string): boolean {
  return RK_PACKAGING_SPEC.test(t.trim());
}

function normalizeRkBlock(texts: string[]): string[] {
  const trimmed = texts.map((t) => t.trim()).filter(Boolean);
  if (!trimmed.length) return [];

  let first = trimmed[0] ?? "";
  const merged = /^(\d{5})\s*(\d{6,})(.*)$/.exec(first.replace(/\s+/g, " ").trim());
  if (merged) {
    const rest = (merged[3] ?? "").trim();
    first = rest ? `${merged[1]} ${merged[2]} ${rest}` : `${merged[1]} ${merged[2]}`;
  }

  if (trimmed.length >= 2 && /^\d{5}$/.test(trimmed[0] ?? "") && /^\d{6,}/.test(trimmed[1] ?? "")) {
    return [`${trimmed[0]} ${trimmed[1]}`, ...trimmed.slice(2)];
  }

  return [first, ...trimmed.slice(1)];
}

function consumeRkLine(
  t: string,
  state: {
    quantity: number | null;
    unit: string | null;
    unit_price: number | null;
    line_total: number | null;
  },
  descParts: string[],
  priceDecimals: number[],
): void {
  if (!t || SKIP.test(t) || /^<b>$/i.test(t)) return;
  if (isRkNonItemText(t)) return;

  const unitPrice = UNIT_PRICE_LINE.exec(t);
  if (unitPrice?.groups) {
    state.unit_price ??= parseDeNumber(unitPrice.groups.price ?? "");
    return;
  }

  if (EUR_PER.test(t)) {
    const m = /^([\d.,]+)/.exec(t);
    if (m) state.unit_price ??= parseDeNumber(m[1] ?? "");
    return;
  }

  if (isRkPackagingLine(t)) {
    descParts.push(t);
    return;
  }

  const qtyUnit = QTY_UNIT_LINE.exec(t) ?? QTY_UNIT_MERGED.exec(t);
  if (qtyUnit?.groups?.qty) {
    if (state.quantity !== null) {
      descParts.push(t);
      return;
    }
    state.quantity = parseDeNumber(qtyUnit.groups.qty);
    if (qtyUnit.groups.unit) state.unit = qtyUnit.groups.unit.trim();
    return;
  }

  if (UNIT_ONLY.test(t)) {
    state.unit ??= UNIT_ONLY.exec(t)?.groups?.u ?? t;
    return;
  }

  if (QTY_ONLY.test(t) && state.quantity === null && !t.includes(",")) {
    const q = parseDeNumber(t);
    if (q !== null && q < 100_000) {
      state.quantity = q;
      return;
    }
  }

  if (PRICE_ONLY.test(t)) {
    const n = parseDeNumber(t);
    if (n !== null && n !== state.quantity && n <= MAX_PLAUSIBLE_PRICE) {
      priceDecimals.push(n);
    }
    return;
  }

  if (/^Alternativposition\s+zu\s+Position/i.test(t)) {
    descParts.push(t);
    return;
  }

  const descTotal = DESC_WITH_TOTAL.exec(t);
  if (descTotal?.groups?.total) {
    const total = parseDeNumber(descTotal.groups.total);
    if (total !== null && total <= MAX_PLAUSIBLE_PRICE) {
      state.line_total ??= total;
      const desc = (descTotal.groups.desc ?? "").trim();
      if (desc) descParts.push(desc);
      return;
    }
  }

  if (t.startsWith("=")) return;

  descParts.push(t);
}

/** Qty / unit price on the same line as position+article (MuPDF tokens without spaces). */
function parseRkAnchorTail(
  tail: string,
  state: {
    quantity: number | null;
    unit: string | null;
    unit_price: number | null;
    line_total: number | null;
  },
): void {
  const rest = tail.replace(/<b>/gi, " ").trim();
  if (!rest) return;

  const qtySpaced = /\b(?<qty>[\d.,]+)\s+(?<unit>ST|SA|M2|St|Stück|Stk|KG|kg\/Sa)\b/i.exec(rest);
  const qtyMerged = /\b(?<qty>[\d.,]+)(?<unit>ST|SA|M2|St|Stück|Stk|KG|kg\/Sa)\b/i.exec(rest);
  const qtyM = qtySpaced ?? qtyMerged;
  if (qtyM?.groups?.qty) {
    state.quantity ??= parseDeNumber(qtyM.groups.qty);
    if (qtyM.groups.unit) state.unit ??= qtyM.groups.unit.trim();
  }

  const eurM = /(?<price>[\d.,]+)\s*EUR\s*\/\s*1\s*(?<unit>ST|SA|M2|St|kg\/Sa)?/i.exec(rest);
  if (eurM?.groups?.price) {
    state.unit_price ??= parseDeNumber(eurM.groups.price);
    if (eurM.groups.unit) state.unit ??= eurM.groups.unit.trim();
  }
}

/** Line-based RK block parser (fallback when X-pipeline finds nothing). */
export function parseRkBlock(texts: string[]): LineItem | null {
  const normalized = normalizeRkBlock(texts.map((t) => t.trim()).filter(Boolean));
  const head = RK_HEAD.exec(normalized[0]?.trim() ?? "");
  const splitHead =
    !head?.groups &&
    /^\d{5}$/.test(normalized[0]?.trim() ?? "") &&
    /^\d{6,}$/.test(normalized[1]?.trim() ?? "");

  if (!head?.groups && !splitHead) return null;

  const position = head?.groups?.pos ?? (splitHead ? normalized[0]!.trim() : null);
  const article_number =
    head?.groups?.art ?? (splitHead ? normalized[1]!.trim() : null);

  const state = {
    quantity: null as number | null,
    unit: null as string | null,
    unit_price: null as number | null,
    line_total: null as number | null,
  };
  const descParts: string[] = [];
  const priceDecimals: number[] = [];

  const tail = (head?.groups?.tail ?? "").trim();
  if (tail) parseRkAnchorTail(tail, state);

  for (let i = splitHead ? 2 : 1; i < normalized.length; i++) {
    const t = normalized[i]?.trim() ?? "";
    if (isRkNonItemText(t)) break;
    consumeRkLine(t, state, descParts, priceDecimals);
  }

  if (priceDecimals.length >= 2) {
    state.unit_price ??= priceDecimals[priceDecimals.length - 2]!;
    state.line_total ??= priceDecimals[priceDecimals.length - 1]!;
  } else if (priceDecimals.length === 1) {
    const n = priceDecimals[0]!;
    if (n >= 500) state.line_total ??= n;
    else state.unit_price ??= n;
  }

  if (
    state.quantity === null &&
    state.unit_price === null &&
    state.line_total === null
  ) {
    return null;
  }

  return {
    position,
    article_number,
    artikel_prefix: null,
    description: descParts.join("\n").trim(),
    quantity: state.quantity,
    unit: state.unit,
    unit_price: state.unit_price,
    line_total: state.line_total,
  };
}

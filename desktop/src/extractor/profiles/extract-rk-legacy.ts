import type { LineItem } from "../models";
import { parseDeNumber } from "../utils";

const RK_HEAD = /^(?<pos>\d{5})\s+(?<art>\d{6,})\b/;

const QTY_UNIT_LINE = /^(?<qty>[\d.,]+)\s+(?<unit>.+)$/i;
const UNIT_ONLY = /^(?<u>ST|M2|SA|St|Stück|Stk|kg|l|m²|m2|qm)$/i;
const QTY_ONLY = /^[\d.,]+$/;
const PRICE_ONLY = /^[\d.,]+$/;
const UNIT_PRICE_LINE = /^(?<price>[\d.,]+)\s+EUR\s*\/\s*/i;
const EUR_PER = /EUR\s*\/\s*1/i;

const SKIP =
  /^(<b>|pos\.|artikel-nr|menge|me|einzel|pos\.-wert|artikelbezeichnung|in eur|übertrag|seite\s)/i;

function normalizeRkBlock(texts: string[]): string[] {
  if (texts.length >= 2 && /^\d{5}$/.test(texts[0] ?? "") && /^\d{6,}/.test(texts[1] ?? "")) {
    return [`${texts[0]} ${texts[1]}`, ...texts.slice(2)];
  }
  return texts;
}

/** Line-based RK block parser (fallback when X-pipeline finds nothing). */
export function parseRkBlock(texts: string[]): LineItem | null {
  const normalized = normalizeRkBlock(texts.map((t) => t.trim()).filter(Boolean));
  const head = RK_HEAD.exec(normalized[0]?.trim() ?? "");
  if (!head?.groups) return null;

  const position = head.groups.pos ?? null;
  const article_number = head.groups.art ?? null;

  const state = {
    quantity: null as number | null,
    unit: null as string | null,
    unit_price: null as number | null,
    line_total: null as number | null,
  };
  const descParts: string[] = [];
  const priceDecimals: number[] = [];

  for (let i = 1; i < normalized.length; i++) {
    const t = normalized[i]?.trim() ?? "";
    if (!t || SKIP.test(t) || t === "<B>") continue;

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

    descParts.push(t);
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
    description: descParts.join(" ").trim(),
    quantity: state.quantity,
    unit: state.unit,
    unit_price: state.unit_price,
    line_total: state.line_total,
  };
}

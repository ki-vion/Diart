import type { LineItem } from "../models";
import { parseDeNumber } from "../utils";

export const NORIT_NET = /^(?<net>[\d.,]+)\s+EUR\s*$/i;
export const NORIT_QTY = /^(?<qty>[\d.,]+)\s+(?<unit>m²|m2|St|kg|l|qm|m)\s*$/i;
export const UNIT_PRICE = /^(?<price>[\d.,]+)\s+EUR\s*\/\s*(?<per>\S+)\s*$/i;
export const NORIT_POS = /^\d{3}$/;
export const NORIT_ART = /^\d{8}$/;

const TABLE_HEADER = /^(Pos|Menge|Nettowert|Einzelpreis|Artikel|Abw\.|EUR)$/i;
const PAGE_BREAK =
  /^(Rechnungsnummer:|Auftragsnummer:|Seite:|Übertrag:|EUR$|D\s+\d+)/i;
const SURCHARGE = /^(Kosten f\.|Frachtkosten)/i;
const META_LABEL = /^(VPE:|Zolltarifnr\.:|Abmessung:|Artikelnummer:)/i;
const DIM_VALUE = /^\d.+(\s+X\s+|\s+x\s+|X|x|MM|mm)/i;

export function isNoritPositionLine(line: string): boolean {
  if (!NORIT_POS.test(line.trim())) return false;
  const n = Number.parseInt(line, 10);
  return Number.isFinite(n) && n >= 110;
}

export function isNoritItemAnchor(lines: string[], index: number): boolean {
  const line = lines[index]?.trim() ?? "";
  if (!isNoritPositionLine(line)) return false;

  const next = lines[index + 1]?.trim() ?? "";
  if (NORIT_NET.test(next)) return true;

  const prev = lines[index - 1]?.trim() ?? "";
  if (NORIT_QTY.test(prev)) return true;

  for (let k = index + 1; k < Math.min(index + 30, lines.length); k++) {
    const t = lines[k]?.trim() ?? "";
    if (isNoritPositionLine(t) && k !== index) break;
    if (NORIT_NET.test(t)) return true;
  }
  return false;
}

export function findNoritAnchors(lines: string[]): number[] {
  const anchors: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isNoritItemAnchor(lines, i)) anchors.push(i);
  }
  return anchors;
}

function isPageNoise(line: string, prev?: string, next?: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (TABLE_HEADER.test(t)) return true;
  if (PAGE_BREAK.test(t)) return true;
  if (SURCHARGE.test(t)) return true;
  if (prev?.trim() === "Übertrag:" && /^[\d.,]+$/.test(t)) return true;
  if (t === "Übertrag:" && next?.trim() === "EUR") return true;
  return false;
}

function pickNoritQuantity(
  candidates: { quantity: number; unit: string }[],
): { quantity: number; unit: string } | null {
  if (candidates.length === 0) return null;
  const m2 = candidates.filter((c) => /m²|m2|^m$/i.test(c.unit));
  if (m2.length > 0) return m2[m2.length - 1]!;
  const kg = candidates.filter((c) => /kg/i.test(c.unit));
  if (kg.length > 0) return kg[kg.length - 1]!;
  return candidates[0]!;
}

/** Norit item block — supports descriptions spanning page breaks before the next Pos. anchor. */
export function parseNoritBlock(block: string[], lineBefore?: string): LineItem | null {
  const position = block[0]?.trim() ?? null;
  if (!position || !isNoritPositionLine(position)) return null;

  let line_total: number | null = null;
  let unit_price: number | null = null;
  let article_number: string | null = null;
  const descParts: string[] = [];
  const qtyCandidates: { quantity: number; unit: string }[] = [];
  let unitPriceSeen = false;
  let skipSurchargeLines = 0;

  const before = lineBefore?.trim() ?? "";
  if (before) {
    const preQty = NORIT_QTY.exec(before);
    if (preQty?.groups) {
      const q = parseDeNumber(preQty.groups.qty ?? "");
      if (q !== null) {
        qtyCandidates.push({ quantity: q, unit: preQty.groups.unit ?? "" });
      }
    }
  }

  for (let i = 1; i < block.length; i++) {
    const t = block[i]?.trim() ?? "";
    const prev = block[i - 1]?.trim();
    const next = block[i + 1]?.trim();

    if (skipSurchargeLines > 0) {
      skipSurchargeLines -= 1;
      continue;
    }

    if (isPageNoise(t, prev, next)) continue;

    if (SURCHARGE.test(t)) {
      skipSurchargeLines = 2;
      continue;
    }

    const net = NORIT_NET.exec(t);
    if (net?.groups) {
      if (!unitPriceSeen && line_total === null) {
        line_total = parseDeNumber(net.groups.net ?? "");
      }
      continue;
    }

    const qty = NORIT_QTY.exec(t);
    if (qty?.groups && !unitPriceSeen) {
      const q = parseDeNumber(qty.groups.qty ?? "");
      if (q !== null) {
        qtyCandidates.push({ quantity: q, unit: qty.groups.unit ?? "" });
      }
      continue;
    }

    const up = UNIT_PRICE.exec(t);
    if (up?.groups) {
      unit_price = parseDeNumber(up.groups.price ?? "");
      unitPriceSeen = true;
      continue;
    }

    if (unitPriceSeen) {
      if (NORIT_ART.test(t)) {
        article_number = t;
        continue;
      }
      if (META_LABEL.test(t)) {
        descParts.push(t);
        continue;
      }
      continue;
    }

    if (NORIT_ART.test(t)) {
      article_number = t;
      continue;
    }

    if (/^[\d.,]+\s+EUR/i.test(t) || t.endsWith("EUR")) continue;

    if (META_LABEL.test(t)) {
      descParts.push(t);
      continue;
    }

    if (DIM_VALUE.test(t)) continue;
    if (/^\d{8}$/.test(t)) continue;

    descParts.push(t);
  }

  const picked = pickNoritQuantity(qtyCandidates);
  const quantity = picked?.quantity ?? null;
  const unit = picked?.unit ?? null;

  if (line_total === null && quantity === null && unit_price === null) return null;
  if (line_total === null && unit_price === null) return null;

  return {
    position,
    article_number,
    artikel_prefix: null,
    description: descParts.join("\n").trim(),
    quantity,
    unit,
    unit_price,
    line_total,
  };
}

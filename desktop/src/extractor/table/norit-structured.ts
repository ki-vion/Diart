import type { LineItem } from "../models";
import type { PdfLine, PdfPageStructured, PdfStructured } from "../../pdf/types";
import type { ColumnRole } from "./header-map";
import { calibrateColumnWindows } from "../pipeline/columns";
import { NORIT_TEMPLATE } from "../pipeline/templates";
import type { ColumnWindow } from "../pipeline/types";
import { parseDeNumber } from "../utils";
import { findTableRegionOrContinuation } from "./table-region";
import { isNonItemLine, isPostTableText } from "./table-zone";
import {
  isNoritPositionLine,
  NORIT_ART,
  NORIT_NET,
  NORIT_QTY,
  UNIT_PRICE,
} from "./norit-block";

const META_LABEL =
  /^(VPE:|Zolltarifnr\.:|Abmessung:|Artikelnummer:|Produkt Zertifizierung:|CoC-Nr\.:|Länge:|Breite:|Charge:)/i;
const PAGE_NOISE =
  /^(Rechnungsnummer:|Auftragsnummer:|Seite:|Übertrag:|Pos|Menge|Nettowert|Einzelpreis|Artikel|Abw\.|EUR$|D\s+\d+)$/i;
const SURCHARGE = /^(Kosten f\.|Frachtkosten)/i;

/** Menge on the row directly above Pos belongs to the previous item, not the new anchor. */
const NORIT_SAME_ROW_Y = 8;

function lineXMin(line: PdfLine): number {
  const xs = line.words.map((w) => w.x);
  return xs.length ? Math.min(...xs) : 0;
}

function isQtyLineForPositionAnchor(prev: PdfLine, posLine: PdfLine): boolean {
  return Math.abs(prev.y - posLine.y) <= NORIT_SAME_ROW_Y;
}

/** One MuPDF fragment → one column (by x), not word-splitting. */
export function columnRoleForLine(line: PdfLine, windows: ColumnWindow[]): ColumnRole | null {
  const x = lineXMin(line);
  for (const w of windows) {
    if (x >= w.xMin && x < w.xMax) return w.role;
  }
  return null;
}

export function noritLineToCells(line: PdfLine, windows: ColumnWindow[]): Partial<Record<ColumnRole, string>> {
  const role = columnRoleForLine(line, windows);
  if (!role) return {};
  return { [role]: line.text.trim() };
}

/** Normalize unit from Menge or Einzelpreis (EUR /…) for matching. */
export function normalizeNoritUnit(unit: string): string {
  const t = unit
    .trim()
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/\./g, "");
  if (t === "m2" || t === "qm") return "m2";
  if (t === "st" || t === "stuck" || t === "stk") return "st";
  if (t === "kg") return "kg";
  if (t === "m") return "m";
  if (t === "l") return "l";
  return t;
}

function unitsMatch(priceUnit: string, qtyUnit: string): boolean {
  return normalizeNoritUnit(priceUnit) === normalizeNoritUnit(qtyUnit);
}

/**
 * Pick billing quantity from Menge column lines.
 * Einzelpreis is always "EUR /Einheit" — that unit selects the matching Menge row.
 */
export function pickNoritQuantity(
  candidates: { quantity: number; unit: string }[],
  priceUnit: string | null,
): { quantity: number; unit: string } | null {
  if (candidates.length === 0) return null;

  if (priceUnit) {
    const matched = candidates.filter((c) => unitsMatch(priceUnit, c.unit));
    if (matched.length === 1) return matched[0]!;
    if (matched.length > 1) return matched[matched.length - 1]!;
  }

  if (candidates.length === 1) return candidates[0]!;
  return candidates[candidates.length - 1]!;
}

function emptyItem(position: string): LineItem {
  return {
    position,
    article_number: null,
    artikel_prefix: null,
    description: "",
    quantity: null,
    unit: null,
    unit_price: null,
    line_total: null,
  };
}

function appendDescription(item: LineItem, text: string): void {
  const t = text.trim();
  if (!t) return;
  item.description = item.description ? `${item.description}\n${t}` : t;
}

function isNoritStructuredAnchor(
  lines: PdfLine[],
  windows: ColumnWindow[],
  index: number,
): boolean {
  const line = lines[index];
  if (!line) return false;
  if (columnRoleForLine(line, windows) !== "position") return false;
  const text = line.text.trim();
  if (!isNoritPositionLine(text)) return false;

  const prev = lines[index - 1];
  if (prev && columnRoleForLine(prev, windows) === "quantity") {
    if (NORIT_QTY.test(prev.text.trim())) return true;
  }

  for (let k = index; k < Math.min(index + 12, lines.length); k++) {
    const t = lines[k]!.text.trim();
    const role = columnRoleForLine(lines[k]!, windows);
    if (k > index && role === "position" && isNoritPositionLine(t)) break;
    if (role === "lineTotal" && NORIT_NET.test(t)) return true;
    if (role === "unitPrice" && UNIT_PRICE.test(t)) return true;
  }
  return false;
}

function shouldSkipFragment(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (PAGE_NOISE.test(t)) return true;
  if (SURCHARGE.test(t)) return true;
  if (NORIT_TEMPLATE.skipLine?.test(t)) return true;
  return false;
}

type PendingLabel = { text: string } | null;

function mergeNoritFragment(
  item: LineItem,
  role: ColumnRole,
  text: string,
  qtyCandidates: { quantity: number; unit: string }[],
  pending: PendingLabel,
  priceUnitOut: { value: string | null },
): PendingLabel {
  const t = text.trim();
  if (!t) return pending;

  if (role === "description") {
    if (META_LABEL.test(t) || /^(CoC-Nr\.|Produkt Zertifizierung:|Länge:|Breite:|Charge:)/i.test(t)) {
      return { text: t };
    }
    appendDescription(item, t);
    return null;
  }

  if (role === "quantity") {
    if (pending) {
      appendDescription(item, pending.text);
      appendDescription(item, t);
      if (/^Artikelnummer:/i.test(pending.text) && NORIT_ART.test(t)) {
        item.article_number ??= t;
      }
      return null;
    }

    const qty = NORIT_QTY.exec(t);
    if (qty?.groups) {
      const q = parseDeNumber(qty.groups.qty ?? "");
      if (q !== null) {
        qtyCandidates.push({ quantity: q, unit: qty.groups.unit ?? "" });
      }
      return null;
    }

    if (NORIT_ART.test(t)) {
      item.article_number ??= t;
      return null;
    }

    appendDescription(item, t);
    return null;
  }

  if (role === "unitPrice") {
    const up = UNIT_PRICE.exec(t);
    if (up?.groups) {
      item.unit_price ??= parseDeNumber(up.groups.price ?? "");
      if (up.groups.per) priceUnitOut.value = up.groups.per;
    }
    return pending;
  }

  if (role === "lineTotal") {
    const net = NORIT_NET.exec(t);
    if (net?.groups) {
      item.line_total ??= parseDeNumber(net.groups.net ?? "");
    }
    return pending;
  }

  return pending;
}

function finalizeItem(
  item: LineItem,
  qtyCandidates: { quantity: number; unit: string }[],
  priceUnit: string | null,
): LineItem | null {
  const picked = pickNoritQuantity(qtyCandidates, priceUnit);
  if (picked) {
    item.quantity ??= picked.quantity;
    item.unit ??= picked.unit;
  }
  if (item.line_total === null && item.unit_price === null) return null;
  return item;
}

function noritHeaderIndex(page: PdfPageStructured): number {
  return page.lines.findIndex((l) => l.text.trim() === "Pos");
}

function collectNoritPageLines(page: PdfPageStructured): PdfLine[] {
  const region = findTableRegionOrContinuation(page);
  let dataStart = region?.dataStartIndex ?? 0;
  let dataEnd = region?.dataEndIndex ?? page.lines.length;

  const headerIdx = noritHeaderIndex(page);
  if (headerIdx >= 0 && dataEnd <= headerIdx + 5) {
    dataStart = Math.max(dataStart, headerIdx + 2);
    dataEnd = page.lines.length;
    for (let i = page.lines.length - 1; i >= dataStart; i--) {
      const line = page.lines[i]!;
      if (isPostTableText(line.text) || isNonItemLine(line, page.height)) {
        dataEnd = i;
      } else {
        break;
      }
    }
  }

  const out: PdfLine[] = [];
  for (let i = dataStart; i < dataEnd; i++) {
    const line = page.lines[i]!;
    if (isNonItemLine(line, page.height)) continue;
    if (shouldSkipFragment(line.text)) continue;
    out.push(line);
  }
  return out;
}

function collectTableLines(pages: PdfPageStructured[]): PdfLine[] {
  const out: PdfLine[] = [];
  for (const page of pages) {
    out.push(...collectNoritPageLines(page));
  }
  return out;
}

/**
 * Norit extraction via header-calibrated X columns.
 * Each MuPDF line fragment is assigned to Pos / Artikel / Menge / Einzelpreis / Nettowert by x.
 * Label rows in Artikel are paired with values from Menge on the same Y band.
 */
export function extractNoritStructured(structured: PdfStructured): LineItem[] {
  const windows = calibrateColumnWindows(
    structured.pages,
    NORIT_TEMPLATE.headerHints,
    NORIT_TEMPLATE.defaultWindows,
  );

  const lines = collectTableLines(structured.pages);
  const items: LineItem[] = [];
  let current: LineItem | null = null;
  let qtyCandidates: { quantity: number; unit: string }[] = [];
  let pending: PendingLabel = null;
  let blockPriceUnit: string | null = null;
  let skipSurcharge = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const text = line.text.trim();

    if (skipSurcharge > 0) {
      skipSurcharge -= 1;
      continue;
    }
    if (SURCHARGE.test(text)) {
      skipSurcharge = 2;
      continue;
    }

    if (isNoritStructuredAnchor(lines, windows, i)) {
      if (current) {
        const done = finalizeItem(current, qtyCandidates, blockPriceUnit);
        if (done) items.push(done);
      }
      current = emptyItem(text);
      qtyCandidates = [];
      pending = null;
      blockPriceUnit = null;
      const priceUnitOut = { value: blockPriceUnit };

      const prev = lines[i - 1];
      if (
        prev &&
        columnRoleForLine(prev, windows) === "quantity" &&
        isQtyLineForPositionAnchor(prev, line)
      ) {
        mergeNoritFragment(current, "quantity", prev.text.trim(), qtyCandidates, null, priceUnitOut);
      }
      blockPriceUnit = priceUnitOut.value;
      continue;
    }

    if (!current) continue;

    const role = columnRoleForLine(line, windows);
    if (!role || role === "position") continue;

    const priceUnitOut: { value: string | null } = { value: blockPriceUnit };
    pending = mergeNoritFragment(current, role, text, qtyCandidates, pending, priceUnitOut);
    blockPriceUnit = priceUnitOut.value;
  }

  if (current) {
    const done = finalizeItem(current, qtyCandidates, blockPriceUnit);
    if (done) items.push(done);
  }

  return items;
}

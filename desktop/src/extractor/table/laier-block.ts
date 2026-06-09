import type { LineItem } from "../models";
import { parseDeNumber } from "../utils";
import { isVkDiscountToken, lineToCells, trimCells } from "../pipeline/columns";
import type { PdfLine } from "../../pdf/types";
import type { ColumnBlockContext } from "./column-block";
import { SQUARE_METER_IN_TEXT } from "../../export/format-artikel";
import {
  isBlockTerminatorLine,
  isPlausibleDescriptionLine,
} from "./line-guards";

/** 8-digit numeric article or R-code surcharge row (e.g. R000008 *). */
export const LAIER_ARTICLE_HEAD = /^(?<id>\d{8})\b|^(?<rcode>R\d{6})\s*\*/;

const QTY_UNIT_LINE = /^(?<qty>[\d.,]+)\s+(?<unit>.+)$/i;
const PRICE_LINE = /^(?<price>[\d.,]+)(?:\s+--\s*\d+\s*%)?$/;
const TOTAL_PARENS = /^\((?<total>[\d.,]+)\)$/;

const SKIP_LINE = /^(artikel$|menge\s+einheit|vk-preis|betrag$|sonstiges)/i;
const LAIER_ALTERNATIV_TAG = /\(Alternativposition\)/i;
const PREIS_PER_LINE = /\(\s*Preis\s+per\s+(\d+)\s*\)/i;
const LAIER_BILLING_UNIT_FALLBACK =
  /^(Sack|Stück|Stk\.?|ltr|m²|m2|m|Kanister|Pal\.?|Bund|Rolle?(?:\(n\))?)$/i;

export function extractLaierArticleId(text: string): string | null {
  const t = text.trim();
  const m = LAIER_ARTICLE_HEAD.exec(t);
  if (!m?.groups) return null;
  return m.groups.id ?? m.groups.rcode ?? null;
}

/** Surcharge row (e.g. R000008 *); billing may continue on the next page. */
export function isLaierRCodeAnchorLine(text: string): boolean {
  return /^R\d{6}\s*\*/i.test(text.trim());
}

/** Suffix on anchor line, e.g. "55501726 (Alternativposition)". */
export function extractLaierAlternativTag(text: string): string | null {
  return LAIER_ALTERNATIV_TAG.test(text) ? "(Alternativposition)" : null;
}

function isStandaloneAlternativLine(text: string): boolean {
  return text.trim() === "(Alternativposition)";
}

function descriptionHasAlternativTag(description: string): boolean {
  return LAIER_ALTERNATIV_TAG.test(description);
}

export function parsePreisPerLine(text: string): { factor: number; label: string } | null {
  const m = PREIS_PER_LINE.exec(text.trim());
  if (!m?.[1]) return null;
  const factor = Number.parseInt(m[1], 10);
  if (!Number.isFinite(factor) || factor <= 0) return null;
  return { factor, label: `(Preis per ${factor})` };
}

export function isLaierSkipLine(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (SKIP_LINE.test(t)) return true;
  if (isVkDiscountToken(t)) return true;
  return false;
}

function isLaierQtyLine(text: string): boolean {
  const t = text.trim();
  if (t.includes("--")) return false;
  if (QTY_UNIT_LINE.test(t)) {
    const unit = QTY_UNIT_LINE.exec(t)?.groups?.unit?.trim() ?? "";
    if (!unit || /^--/.test(unit)) return false;
    return true;
  }
  return /^[\d.,]+\s*(m²|m2|m|ltr|Stück|Stk|Sack)\b/i.test(t);
}

function isLaierPriceLine(text: string): boolean {
  return PRICE_LINE.test(text.trim());
}

function isLaierTotalLine(text: string): boolean {
  const t = text.trim();
  if (TOTAL_PARENS.test(t)) return true;
  return isLaierPriceLine(t) && !t.includes("--");
}

/**
 * Item starts on an article-id line; qty/price appear within the next few lines
 * (description and Alternativposition lines may sit in between).
 */
export function isLaierItemAnchor(lines: PdfLine[], index: number): boolean {
  const head = lines[index]?.text.trim() ?? "";
  const id = extractLaierArticleId(head);
  if (!id) return false;

  if (isLaierRCodeAnchorLine(head)) return true;

  const afterArt = lines[index + 1]?.text.trim() ?? "";
  if (/artikelnummer|zolltarif|abmessung|produkt\s+zert/i.test(afterArt)) return false;

  let foundQty = false;
  let pendingQtyOnly: number | null = null;
  let foundPrice = false;

  for (let j = index + 1; j < Math.min(index + 12, lines.length); j++) {
    const t = lines[j]?.text.trim() ?? "";
    if (!t) continue;
    if (extractLaierArticleId(t) && j > index + 1) break;

    if (isLaierSkipLine(t)) continue;

    // Some Laier rows split quantity and unit across two lines: "1.100" then "Stück"
    if (!foundQty && pendingQtyOnly !== null) {
      if (LAIER_BILLING_UNIT_FALLBACK.test(t)) {
        foundQty = true;
        pendingQtyOnly = null;
      } else if (!/^[\d.,]+$/.test(t)) {
        pendingQtyOnly = null;
      }
    }

    if (isLaierQtyLine(t)) foundQty = true;
    if (!foundQty && /^[\d.,]+$/.test(t)) {
      const n = parseDeNumber(t);
      if (n !== null) pendingQtyOnly = n;
    }
    if (isLaierPriceLine(t) || isLaierTotalLine(t)) foundPrice = true;

    if (foundQty && foundPrice) return true;
  }

  return false;
}

function mergeLaierBillingFields(
  item: LineItem,
  cells: ReturnType<typeof trimCells>,
  lineText: string,
): void {
  const qtyRaw = cells.quantity?.trim() ?? "";
  if (qtyRaw) {
    const q = parseDeNumber(qtyRaw);
    if (q !== null) item.quantity ??= q;
  }

  const unit = cells.unit?.trim();
  if (unit) item.unit ??= unit;

  const up = parseDeNumber(cells.unitPrice ?? "");
  if (up !== null) item.unit_price ??= up;

  const total = parseDeNumber(cells.lineTotal ?? "");
  if (total !== null) item.line_total ??= total;

  if (item.line_total === null && TOTAL_PARENS.test(lineText.trim())) {
    const m = TOTAL_PARENS.exec(lineText.trim());
    if (m?.groups) item.line_total = parseDeNumber(m.groups.total ?? "");
  }

  if (item.unit_price === null && PRICE_LINE.test(lineText.trim()) && lineText.includes("--")) {
    const m = PRICE_LINE.exec(lineText.trim());
    if (m?.groups) item.unit_price = parseDeNumber(m.groups.price ?? "");
  }
}

/** MuPDF splits "55 m²)" into "55 m" + "²)" on the next line. */
function isSuperscriptContinuationLine(text: string): boolean {
  return /^²\)?$|^³\)?$/.test(text.trim());
}

function mergeSuperscriptOntoLastLine(lines: string[], lineText: string): boolean {
  if (!isSuperscriptContinuationLine(lineText)) return false;
  const prev = lines[lines.length - 1]?.trim() ?? "";
  if (!/\d[\d.,]*\s+m$/i.test(prev)) return false;
  const sup = lineText.startsWith("³") ? "³" : "²";
  lines[lines.length - 1] = `${prev}${sup}${lineText.includes(")") ? ")" : ""}`;
  return true;
}

function mergeSuperscriptOntoPreviousDescription(item: LineItem, lineText: string): boolean {
  const parts = item.description ? item.description.split("\n") : [];
  if (!mergeSuperscriptOntoLastLine(parts, lineText)) return false;
  item.description = parts.join("\n").trim();
  return true;
}

function appendLaierDescription(
  item: LineItem,
  line: PdfLine,
  cells: ReturnType<typeof trimCells>,
  ctx: ColumnBlockContext,
): void {
  const lineText = line.text.trim();
  if (mergeSuperscriptOntoPreviousDescription(item, lineText)) return;
  if (/^²$|^³$/.test(lineText)) return;

  const desc = cells.description?.trim() ?? "";
  if (
    (isStandaloneAlternativLine(lineText) || isStandaloneAlternativLine(desc)) &&
    descriptionHasAlternativTag(item.description)
  ) {
    return;
  }
  if (!desc || isLaierSkipLine(desc) || isVkDiscountToken(desc)) return;
  if (extractLaierArticleId(desc)) return;
  if (/^[\d.,]+$/.test(desc)) return;
  if (PREIS_PER_LINE.test(desc)) return;
  if (!isPlausibleDescriptionLine(line, ctx.windows)) return;
  item.description = item.description ? `${item.description}\n${desc}`.trim() : desc;
}

function mergeSplitDimensionLines(lines: string[]): string[] {
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i]!;
    const next = lines[i + 1]?.trim() ?? "";
    if (/\d[\d.,]*\s+m$/i.test(cur) && (next === "²" || next === "²)")) {
      merged.push(`${cur}²${next === "²)" ? ")" : ""}`);
      i += 1;
      continue;
    }
    if (/^²\)?$/.test(cur)) continue;
    merged.push(cur);
  }
  return merged;
}

function dedupeAlternativDescriptionLines(lines: string[]): string[] {
  let seenAlternativ = false;
  return lines.filter((line) => {
    if (!isStandaloneAlternativLine(line)) return true;
    if (seenAlternativ) return false;
    seenAlternativ = true;
    return true;
  });
}

function finalizeLaierItem(item: LineItem, preisPerLabels: string[] = []): void {
  const lines = dedupeAlternativDescriptionLines(
    mergeSplitDimensionLines(
      item.description
        .split("\n")
        .map((l) => l.trim())
        .filter(
          (l) =>
            l &&
            !isVkDiscountToken(l) &&
            !isLaierSkipLine(l) &&
            !/^sonstiges\b/i.test(l),
        ),
    ),
  );

  for (const label of preisPerLabels) {
    if (!lines.some((l) => PREIS_PER_LINE.test(l))) lines.push(label);
  }

  item.description = lines.join("\n").trim();

  if (item.unit === "m" && SQUARE_METER_IN_TEXT.test(item.description)) {
    item.unit = "m²";
  }
}

/** Billing fields from calibrated X columns (Menge / Einheit / VK-Preis / Betrag). */
export function parseLaierColumnBlock(
  lines: PdfLine[],
  ctx: ColumnBlockContext,
): LineItem | null {
  const headText = lines[0]?.text.trim() ?? "";
  const article_number = extractLaierArticleId(headText);
  if (!article_number) return null;

  const alternativTag = extractLaierAlternativTag(headText);

  const item: LineItem = {
    position: null,
    article_number,
    artikel_prefix: null,
    description: alternativTag ?? "",
    quantity: null,
    unit: null,
    unit_price: null,
    line_total: null,
    price_per: null,
  };

  const preisPerLabels: string[] = [];
  let pendingQtyOnly: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const text = line.text.trim();
    if (!text) continue;
    if (isBlockTerminatorLine(text)) break;
    if (i > 0 && extractLaierArticleId(text)) break;

    const preisPer = parsePreisPerLine(text);
    if (preisPer) {
      item.price_per ??= preisPer.factor;
      preisPerLabels.push(preisPer.label);
      continue;
    }

    if (isLaierSkipLine(text)) continue;

    const cells = trimCells(lineToCells(line, ctx.windows, ctx.catchAllMaxX));

    // Quantity and unit sometimes come as two separate lines (quantity-only then unit-only).
    if (pendingQtyOnly !== null) {
      const unit = cells.unit?.trim() ?? "";
      if (unit && LAIER_BILLING_UNIT_FALLBACK.test(unit)) {
        item.quantity ??= pendingQtyOnly;
        item.unit ??= unit;
        pendingQtyOnly = null;
        continue;
      }
      // If the next line is not a unit, drop the pending quantity.
      if (!/^[\d.,]+$/.test(text)) {
        pendingQtyOnly = null;
      }
    }

    const hasBilling = Boolean(
      cells.quantity?.trim() ||
        cells.unit?.trim() ||
        cells.unitPrice?.trim() ||
        cells.lineTotal?.trim(),
    );

    if (hasBilling) {
      mergeLaierBillingFields(item, cells, text);
      // Anchor line (i=0): article id and (Alternativposition) already taken from headText.
      if (i > 0 && cells.description?.trim()) {
        appendLaierDescription(item, line, cells, ctx);
      }
    } else {
      // If we got a naked quantity outside the calibrated band (e.g. x ~ 344),
      // remember it and let the next "Stück" line attach the unit.
      if (item.quantity === null && /^[\d.,]+$/.test(text)) {
        const n = parseDeNumber(text);
        if (n !== null) {
          pendingQtyOnly = n;
          continue;
        }
      }
      if (i > 0) {
        appendLaierDescription(item, line, cells, ctx);
      }
    }
  }

  if (item.quantity === null && item.unit_price === null && item.line_total === null) {
    return null;
  }

  finalizeLaierItem(item, preisPerLabels);
  return item;
}

export function parseLaierBlock(texts: string[]): LineItem | null {
  const headText = texts[0]?.trim() ?? "";
  const article_number = extractLaierArticleId(headText);
  if (!article_number) return null;

  const descParts: string[] = [];
  const alternativTag = extractLaierAlternativTag(headText);
  if (alternativTag) descParts.push(alternativTag);
  const preisPerLabels: string[] = [];
  let quantity: number | null = null;
  let unit: string | null = null;
  let unit_price: number | null = null;
  let line_total: number | null = null;
  let price_per: number | null = null;
  const barePrices: number[] = [];

  for (let i = 1; i < texts.length; i++) {
    const t = texts[i]!.trim();
    if (!t) continue;
    if (extractLaierArticleId(t)) break;

    const preisPer = parsePreisPerLine(t);
    if (preisPer) {
      price_per ??= preisPer.factor;
      preisPerLabels.push(preisPer.label);
      continue;
    }

    if (isLaierSkipLine(t)) continue;

    if (mergeSuperscriptOntoLastLine(descParts, t)) continue;
    if (/^²$|^³$/.test(t)) continue;

    const qtyMatch = !t.includes("--") ? QTY_UNIT_LINE.exec(t) : null;
    if (qtyMatch?.groups) {
      const unitPart = qtyMatch.groups.unit?.trim() ?? "";
      if (unitPart && !/^--/.test(unitPart)) {
        quantity ??= parseDeNumber(qtyMatch.groups.qty ?? "");
        unit ??= unitPart || null;
        continue;
      }
    }

    if (/^[\d.,]+$/.test(t) && quantity === null && i + 1 < texts.length) {
      const next = texts[i + 1]!.trim();
      if (
        next &&
        LAIER_BILLING_UNIT_FALLBACK.test(next) &&
        !isLaierPriceLine(next) &&
        !TOTAL_PARENS.test(next)
      ) {
        quantity = parseDeNumber(t);
        unit = next;
        i += 1;
        continue;
      }
    }

    if (isLaierQtyLine(t) && quantity === null) {
      const m = QTY_UNIT_LINE.exec(t);
      if (m?.groups) {
        quantity = parseDeNumber(m.groups.qty ?? "");
        unit = m.groups.unit?.trim() || null;
      }
      continue;
    }

    const totalMatch = TOTAL_PARENS.exec(t);
    if (totalMatch?.groups) {
      line_total ??= parseDeNumber(totalMatch.groups.total ?? "");
      continue;
    }

    const priceMatch = PRICE_LINE.exec(t);
    if (priceMatch?.groups) {
      const n = parseDeNumber(priceMatch.groups.price ?? "");
      if (n !== null) {
        if (t.includes("--") && unit_price === null) {
          unit_price = n;
        } else {
          barePrices.push(n);
        }
      }
      continue;
    }

    if (!isLaierPriceLine(t) && !isLaierTotalLine(t) && !isVkDiscountToken(t)) {
      if (isStandaloneAlternativLine(t) && descParts.some(isStandaloneAlternativLine)) continue;
      descParts.push(t);
    }
  }

  if (barePrices.length >= 2) {
    unit_price ??= barePrices[barePrices.length - 2]!;
    line_total ??= barePrices[barePrices.length - 1]!;
  } else if (barePrices.length === 1) {
    if (unit_price === null) unit_price = barePrices[0]!;
    else line_total ??= barePrices[0]!;
  }

  if (quantity === null && unit_price === null && line_total === null) return null;

  const item: LineItem = {
    position: null,
    article_number,
    artikel_prefix: null,
    description: descParts.join("\n").trim(),
    quantity,
    unit,
    unit_price,
    line_total,
    price_per,
  };
  finalizeLaierItem(item, preisPerLabels);
  return item;
}

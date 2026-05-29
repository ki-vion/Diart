import type { ExtractionResult, LineItem } from "../models";
import { parseDeNumber } from "../utils";
import type { PdfStructured } from "../../pdf/types";
import { extractWithTemplate } from "../pipeline/extract";
import { NORIT_TEMPLATE } from "../pipeline/templates";
import { allAsTextLines } from "./lines";

const NORIT_NET = /^(?<net>[\d.,]+)\s+EUR\s*$/i;
const NORIT_QTY = /^(?<qty>[\d.,]+)\s+(?<unit>m²|m2|St|kg|l|qm)\s*$/i;
const UNIT_PRICE = /^(?<price>[\d.,]+)\s+EUR\s*\/\s*(?<per>\S+)\s*$/i;
const ARTNR = /^\d{8}$/;

const SKIP_PREFIXES = [
  "Pos",
  "Nettowert",
  "Einzelpreis",
  "Artikel",
  "Abw.",
  "Menge",
  "Übertrag",
  "Zolltarif",
  "Produkt",
  "CoC-",
  "Länge:",
  "Breite:",
  "Charge:",
  "VPE:",
  "Abmessung:",
  "Artikelnummer:",
  "EUR",
  "Rechnungsnummer",
  "Seite:",
] as const;

function shouldSkip(line: string): boolean {
  return SKIP_PREFIXES.some((p) => line.startsWith(p));
}

function isNoritPositionLine(line: string): boolean {
  if (!/^\d{3}$/.test(line)) return false;
  const n = Number.parseInt(line, 10);
  return Number.isFinite(n) && n >= 1 && n <= 999;
}

export function isNoritItemAnchor(lines: string[], index: number): boolean {
  const line = lines[index]?.trim() ?? "";
  if (!isNoritPositionLine(line)) return false;

  const next = lines[index + 1]?.trim() ?? "";
  if (NORIT_NET.test(next)) return true;

  const prev = lines[index - 1]?.trim() ?? "";
  if (!NORIT_QTY.test(prev)) return false;

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

export function parseNoritBlock(block: string[], lineBefore?: string): LineItem | null {
  const position = block[0]?.trim() ?? null;
  if (!position) return null;

  let line_total: number | null = null;
  let unit_price: number | null = null;
  let article_number: string | null = null;
  const descParts: string[] = [];
  const qtyCandidates: { quantity: number; unit: string }[] = [];

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
    if (!t || shouldSkip(t)) continue;

    const net = NORIT_NET.exec(t);
    if (net?.groups) {
      line_total = parseDeNumber(net.groups.net ?? "");
      continue;
    }

    const qty = NORIT_QTY.exec(t);
    if (qty?.groups) {
      const q = parseDeNumber(qty.groups.qty ?? "");
      if (q !== null) {
        qtyCandidates.push({ quantity: q, unit: qty.groups.unit ?? "" });
      }
      continue;
    }

    const up = UNIT_PRICE.exec(t);
    if (up?.groups) {
      unit_price = parseDeNumber(up.groups.price ?? "");
      continue;
    }

    if (ARTNR.test(t)) {
      article_number = t;
      continue;
    }

    if (/^[\d.,]+\s+EUR/i.test(t)) continue;
    if (/^D\s+\d+/.test(t)) continue;

    descParts.push(t);
  }

  const picked = pickNoritQuantity(qtyCandidates);
  const quantity = picked?.quantity ?? null;
  const unit = picked?.unit ?? null;

  if (line_total === null && quantity === null && unit_price === null) return null;

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

function pickNoritQuantity(
  candidates: { quantity: number; unit: string }[],
): { quantity: number; unit: string } | null {
  if (candidates.length === 0) return null;
  const m2 = candidates.filter((c) => /m²|m2/i.test(c.unit));
  if (m2.length > 0) return m2[m2.length - 1]!;
  return candidates[candidates.length - 1]!;
}

function extractNoritFromLinesFallback(
  lines: string[],
  source_pdf: string,
): ExtractionResult {
  const anchors = findNoritAnchors(lines);
  const items: LineItem[] = [];

  for (let a = 0; a < anchors.length; a++) {
    const start = anchors[a]!;
    const end = a + 1 < anchors.length ? anchors[a + 1]! : lines.length;
    const lineBefore = start > 0 ? lines[start - 1] : undefined;
    const item = parseNoritBlock(lines.slice(start, end), lineBefore);
    if (item) items.push(item);
  }

  return { layout_id: "norit_rechnung", source_pdf, items };
}

export function extractNoritFromLines(
  lines: string[],
  source_pdf: string,
): ExtractionResult {
  return extractNoritFromLinesFallback(lines, source_pdf);
}

export function extractNorit(
  structured: PdfStructured,
  source_pdf: string,
): ExtractionResult {
  const fromPipeline = extractWithTemplate(structured, NORIT_TEMPLATE);
  if (fromPipeline.length > 0) {
    return { layout_id: "norit_rechnung", source_pdf, items: fromPipeline };
  }

  return extractNoritFromLinesFallback(allAsTextLines(structured), source_pdf);
}

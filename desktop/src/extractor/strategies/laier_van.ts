import type { ExtractionResult, LineItem } from "../models";
import { parseDeNumber } from "../utils";

const ARTNR = /^\d{8}$/;
const QTY_UNIT = /^(?<qty>[\d.,]+)\s+(?<unit>.+)$/;
const PRICE = /^[\d.,]+$/;
const SKIP_PREFIXES = [
  "Artikel",
  "PREISBINDUNG",
  "Kom.:",
  "Dieser Artikel",
  "Die Rückgabe",
  "Alternativposition",
  "Sonstiges",
  "Menge Einheit",
] as const;

function startsWithAnySkipPrefix(line: string): boolean {
  return SKIP_PREFIXES.some((p) => line.startsWith(p));
}

export function extractFromLines(lines: string[], source_pdf: string): ExtractionResult {
  const items: LineItem[] = [];
  let position = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line || startsWithAnySkipPrefix(line)) {
      i += 1;
      continue;
    }
    if (!ARTNR.test(line)) {
      i += 1;
      continue;
    }

    const art = line;
    if (i + 4 >= lines.length) break;

    const desc = lines[i + 1] ?? "";
    const qtyMatch = QTY_UNIT.exec(lines[i + 2] ?? "");
    const priceLine = (lines[i + 3] ?? "").trim();
    const totalLine = (lines[i + 4] ?? "").trim();

    if (!qtyMatch?.groups || !PRICE.test(priceLine) || !PRICE.test(totalLine)) {
      i += 1;
      continue;
    }

    position += 1;
    items.push({
      position: String(position),
      article_number: art,
      description: desc,
      quantity: parseDeNumber(qtyMatch.groups.qty ?? ""),
      unit: (qtyMatch.groups.unit ?? "").trim() || null,
      unit_price: parseDeNumber(priceLine),
      line_total: parseDeNumber(totalLine),
    });

    i += 5;
  }

  return { layout_id: "laier_van", source_pdf, items };
}


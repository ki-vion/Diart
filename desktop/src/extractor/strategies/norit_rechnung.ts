import type { ExtractionResult, LineItem } from "../models";
import { parseDeNumber } from "../utils";
import type { Strategy } from "./base";

const POS = /^\d{3}$/;
const NET = /^(?<net>[\d.,]+)\s+EUR\s*$/i;
const QTY = /^(?<qty>[\d.,]+)\s+(?<unit>m²|m2|St|kg|l|qm)\s*$/i;
const UNIT_PRICE = /^(?<price>[\d.,]+)\s+EUR\s*\/\s*(?<per>\S+)\s*$/i;
const ARTNR = /^\d{8}$/;
const SKIP = [
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
] as const;

function startsWithAnySkipPrefix(line: string): boolean {
  return SKIP.some((p) => line.startsWith(p));
}

export function extractFromLines(lines: string[], source_pdf: string): ExtractionResult {
  const items: LineItem[] = [];

  let i = 0;
  while (i < lines.length) {
    const posLine = lines[i] ?? "";
    if (!POS.test(posLine)) {
      i += 1;
      continue;
    }

    if (i + 1 >= lines.length) break;
    const netMatch = NET.exec(lines[i + 1] ?? "");
    if (!netMatch?.groups) {
      i += 1;
      continue;
    }

    const position = posLine;
    const line_total = parseDeNumber(netMatch.groups.net ?? "");
    const descParts: string[] = [];
    let quantity: number | null = null;
    let unit: string | null = null;
    let unit_price: number | null = null;
    let article_number: string | null = null;

    let j = i + 2;
    while (j < lines.length) {
      const line = lines[j] ?? "";

      // next item header
      const nextPos = POS.test(line);
      const nextNet = j + 1 < lines.length && NET.test(lines[j + 1] ?? "");
      if (nextPos && nextNet) break;

      if (startsWithAnySkipPrefix(line)) {
        j += 1;
        continue;
      }

      const qtyMatch = QTY.exec(line);
      if (qtyMatch?.groups) {
        quantity = parseDeNumber(qtyMatch.groups.qty ?? "");
        unit = (qtyMatch.groups.unit ?? "").trim() || null;
        j += 1;
        continue;
      }

      const priceMatch = UNIT_PRICE.exec(line);
      if (priceMatch?.groups) {
        unit_price = parseDeNumber(priceMatch.groups.price ?? "");
        j += 1;
        continue;
      }

      if (ARTNR.test(line)) {
        article_number = line;
        j += 1;
        continue;
      }

      if (line && !line.endsWith("EUR")) {
        descParts.push(line);
      }
      j += 1;
    }

    items.push({
      position,
      article_number,
      description: descParts.join(" ").trim(),
      quantity,
      unit,
      unit_price,
      line_total,
    });

    i = j;
  }

  return { layout_id: "norit_rechnung", source_pdf, items };
}

export const NoritRechnungStrategy: Strategy = {
  layout_id: "norit_rechnung",
  matchesPage0Text: (page0Text: string) => page0Text.includes("Rechnungsnummer:") && page0Text.includes("Einzelpreis"),
  extract: (pdf: { pages: { lines: string[] }[] }, source_pdf: string) => {
    const lines: string[] = [];
    for (const page of pdf.pages) for (const line of page.lines) lines.push(line.trim());
    return extractFromLines(lines, source_pdf);
  },
};


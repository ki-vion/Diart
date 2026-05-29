import type { ExtractionResult, LineItem } from "../models";
import { parseDeNumber } from "../utils";

const POS_HEAD = /^(?<pos>\d{3})\s+Artikelnummer:\s+(?<art>\S+)/;

export function extractFromLines(lines: string[], source_pdf: string): ExtractionResult {
  const items: LineItem[] = [];

  let i = 0;
  while (i < lines.length) {
    const m = POS_HEAD.exec(lines[i] ?? "");
    if (!m?.groups) {
      i += 1;
      continue;
    }

    if (i + 4 >= lines.length) break;

    const qtyLine = lines[i + 1] ?? "";
    const unitLine = lines[i + 2] ?? "";
    const priceLine = lines[i + 3] ?? "";
    const totalLine = lines[i + 4] ?? "";

    const descLines: string[] = [];
    let j = i + 5;
    while (j < lines.length && !POS_HEAD.test(lines[j] ?? "")) {
      const l = (lines[j] ?? "").trim();
      if (!l) {
        j += 1;
        continue;
      }
      if (l === "Pos." || l === "Übertrag" || l === "Betrag EUR" || l.startsWith("Übertrag")) {
        break;
      }
      descLines.push(l);
      j += 1;
    }

    const unitTrimmed = unitLine.trim();
    items.push({
      position: m.groups.pos ?? null,
      article_number: m.groups.art ?? null,
      description: descLines.join(" ").trim(),
      quantity: parseDeNumber(qtyLine),
      unit: unitTrimmed ? unitTrimmed : null,
      unit_price: parseDeNumber(priceLine),
      line_total: parseDeNumber(totalLine),
    });

    i = j;
  }

  return { layout_id: "kan_ifb", source_pdf, items };
}


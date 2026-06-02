import type { ExtractionResult, LineItem } from "../models";
import { parseDeNumber } from "../utils";
import { isKanAnchorLine, KAN_POS_MERGED, parseKanAnchorHead } from "../table/kan-block";

const KAN_STOP = /^(Pos\.|Übertrag|Betrag EUR|Seite\s+\d)/i;
const KAN_ALTERNATIV_MARKER = /^alternativ$/i;

export function extractFromLines(lines: string[], source_pdf: string): ExtractionResult {
  const items: LineItem[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = (lines[i] ?? "").trim();
    const next = (lines[i + 1] ?? "").trim();

    if (!isKanAnchorLine(line, next)) {
      i += 1;
      continue;
    }

    const parsed = parseKanAnchorHead(
      KAN_POS_MERGED.test(line) ? [line] : [line, next],
    );
    if (!parsed) {
      i += 1;
      continue;
    }

    const dataStart = i + parsed.startIdx;
    if (dataStart + 4 > lines.length) break;

    const descLines: string[] = [];
    let j = dataStart + 4;
    while (j < lines.length) {
      const l = (lines[j] ?? "").trim();
      if (!l) {
        j += 1;
        continue;
      }
      if (KAN_STOP.test(l) || isKanAnchorLine(l, lines[j + 1])) break;
      if (KAN_ALTERNATIV_MARKER.test(l)) continue;
      descLines.push(l);
      j += 1;
    }

    items.push({
      position: parsed.position,
      article_number: parsed.article_number,
      artikel_prefix: null,
      description: descLines.join("\n").trim(),
      quantity: parseDeNumber(lines[dataStart] ?? ""),
      unit: (lines[dataStart + 1] ?? "").trim() || null,
      unit_price: parseDeNumber(lines[dataStart + 2] ?? ""),
      line_total: parseDeNumber(lines[dataStart + 3] ?? ""),
    });

    i = j;
  }

  return { layout_id: "IFB GmbH", source_pdf, items };
}

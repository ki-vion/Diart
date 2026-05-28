import type { ExtractionResult, LineItem } from "../models";
import { parseDeNumber } from "../utils";
import type { Strategy } from "./base";

// The Python version uses word-level coordinates to reconstruct a table.
// In the PWA/desktop pipeline we only have line text, so we approximate by parsing
// the flattened row strings MuPDF produces.

const ROW_HEAD =
  /^(?<pos>\d+)\s+(?<art>\d+)\s+(?<rest>.+)$/;

const ROW_TAIL =
  /^(?<desc>.*)\s+(?<qty>[\d.,]+)\s+(?<unit>\S+)\s+(?<price>[\d.,]+)(?:\s*(?:EUR\/1|EUR))?\s+(?<total>[\d.,]+)\s*$/i;

function parseRowLine(line: string): Omit<LineItem, "description"> & { description: string } | null {
  const head = ROW_HEAD.exec(line);
  if (!head?.groups) return null;

  const pos = head.groups.pos ?? "";
  const art = head.groups.art ?? "";
  const rest = head.groups.rest ?? "";

  const tail = ROW_TAIL.exec(rest);
  if (!tail?.groups) return null;

  return {
    position: pos,
    article_number: art,
    description: (tail.groups.desc ?? "").trim(),
    quantity: parseDeNumber(tail.groups.qty ?? ""),
    unit: (tail.groups.unit ?? "").trim() || null,
    unit_price: parseDeNumber(tail.groups.price ?? ""),
    line_total: parseDeNumber(tail.groups.total ?? ""),
  };
}

export function extractFromLines(lines: string[], source_pdf: string): ExtractionResult {
  const items: LineItem[] = [];
  let current: LineItem | null = null;

  for (const raw of lines) {
    const line = (raw ?? "").trim();
    if (!line) continue;

    const parsed = parseRowLine(line);
    if (parsed) {
      current = parsed;
      items.push(current);
      continue;
    }

    // Continuation line: append to last item's description (similar intent to Python's extra art column tokens)
    if (current) {
      const append = line.trim();
      if (append) current.description = `${current.description} ${append}`.trim();
    }
  }

  return { layout_id: "rk_stark", source_pdf, items };
}

export const RkStarkStrategy: Strategy = {
  layout_id: "rk_stark",
  matchesPage0Text: (page0Text: string) =>
    page0Text.includes("STARK Deutschland") || page0Text.includes("Raab Karcher"),
  extract: (pdf: { pages: { lines: string[] }[] }, source_pdf: string) => {
    const lines: string[] = [];
    for (const page of pdf.pages) for (const line of page.lines) lines.push(line.trim());
    return extractFromLines(lines, source_pdf);
  },
};


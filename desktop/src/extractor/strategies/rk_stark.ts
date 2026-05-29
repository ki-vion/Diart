import type { ExtractionResult, LineItem } from "../models";
import { parseDeNumber } from "../utils";
import { parseRkBlock } from "../profiles/extract-rk-legacy";

const ROW_HEAD =
  /^(?<pos>\d+)\s+(?<art>\d+)\s+(?<rest>.+)$/;

const ROW_TAIL =
  /^(?<desc>.*)\s+(?<qty>[\d.,]+)\s+(?<unit>\S+)\s+(?<price>[\d.,]+)(?:\s*(?:EUR\/1|EUR))?\s+(?<total>[\d.,]+)\s*$/i;

/** Legacy single-line RK row (tests / rare flat exports). */
function parseRowLine(line: string): LineItem | null {
  const head = ROW_HEAD.exec(line);
  if (!head?.groups) return null;

  const rest = head.groups.rest ?? "";
  const tail = ROW_TAIL.exec(rest);
  if (!tail?.groups) return null;

  return {
    position: head.groups.pos ?? null,
    article_number: head.groups.art ?? null,
    description: (tail.groups.desc ?? "").trim(),
    quantity: parseDeNumber(tail.groups.qty ?? ""),
    unit: (tail.groups.unit ?? "").trim() || null,
    unit_price: parseDeNumber(tail.groups.price ?? ""),
    line_total: parseDeNumber(tail.groups.total ?? ""),
  };
}

export function extractFromLines(lines: string[], source_pdf: string): ExtractionResult {
  const items: LineItem[] = [];
  let block: string[] = [];

  const flush = () => {
    if (block.length === 0) return;
    const fromBlock = parseRkBlock(block);
    if (fromBlock) items.push(fromBlock);
    else {
      const single = parseRowLine(block[0] ?? "");
      if (single) items.push(single);
    }
    block = [];
  };

  for (const raw of lines) {
    const line = (raw ?? "").trim();
    if (!line) continue;

    if (/^\d{5}\s+\d{6,}\b/.test(line)) {
      flush();
      block = [line];
      continue;
    }

    if (block.length > 0) block.push(line);
  }
  flush();

  return { layout_id: "rk_stark", source_pdf, items };
}


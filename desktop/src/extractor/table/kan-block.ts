import type { LineItem } from "../models";
import { parseDeNumber } from "../utils";
import type { PdfLine } from "../../pdf/types";
import { isNonItemLine } from "./table-zone";

export const KAN_POS_MERGED = /^(?<pos>\d{3})\s+(\*)?Artikelnummer:\s+(?<art>\S+)/i;
export const KAN_POS_LINE = /^\d{3}$/;
export const KAN_ART_LINE = /^(\*)?Artikelnummer:\s+(?<art>\S+)/i;

export function isKanSplitAnchor(lines: { text: string }[], index: number): boolean {
  const pos = lines[index]?.text.trim() ?? "";
  const art = lines[index + 1]?.text.trim() ?? "";
  return KAN_POS_LINE.test(pos) && KAN_ART_LINE.test(art);
}

export function isKanAnchorLine(text: string, nextLine?: string): boolean {
  if (KAN_POS_MERGED.test(text.trim())) return true;
  if (nextLine !== undefined) {
    return KAN_POS_LINE.test(text.trim()) && KAN_ART_LINE.test(nextLine.trim());
  }
  return false;
}

export function parseKanAnchorHead(texts: string[]): {
  position: string | null;
  article_number: string | null;
  startIdx: number;
} | null {
  const merged = KAN_POS_MERGED.exec(texts[0]?.trim() ?? "");
  if (merged?.groups) {
    return {
      position: merged.groups.pos ?? null,
      article_number: merged.groups.art ?? null,
      startIdx: 1,
    };
  }
  if (KAN_POS_LINE.test(texts[0]?.trim() ?? "") && KAN_ART_LINE.test(texts[1]?.trim() ?? "")) {
    const art = KAN_ART_LINE.exec(texts[1]?.trim() ?? "");
    return {
      position: texts[0]?.trim() ?? null,
      article_number: art?.groups?.art ?? null,
      startIdx: 2,
    };
  }
  return null;
}

const KAN_STOP = /^(Pos\.|Übertrag|Betrag EUR|Seite\s+\d)/i;
/** PDF marker line between main and alternative article — not part of the description. */
const KAN_ALTERNATIV_MARKER = /^alternativ$/i;

/** KAN IFB stacked block: pos[+art], qty, unit, price, total, description lines. */
export function parseKanBlock(lines: PdfLine[]): LineItem | null {
  const texts = lines.map((l) => l.text.trim()).filter(Boolean);
  const head = parseKanAnchorHead(texts);
  if (!head) return null;

  const { position, article_number, startIdx } = head;
  if (startIdx + 4 > texts.length) return null;

  const quantity = parseDeNumber(texts[startIdx] ?? "");
  const unit = texts[startIdx + 1]?.trim() || null;
  const unit_price = parseDeNumber(texts[startIdx + 2] ?? "");
  const line_total = parseDeNumber(texts[startIdx + 3] ?? "");

  const descParts: string[] = [];
  for (let i = startIdx + 4; i < texts.length; i++) {
    const t = texts[i]!;
    if (KAN_STOP.test(t)) break;
    if (isKanAnchorLine(t, texts[i + 1])) break;
    if (isNonItemLine(lines[i]!, 842)) break;
    if (KAN_ALTERNATIV_MARKER.test(t)) continue;
    descParts.push(t);
  }

  if (quantity === null && unit_price === null && line_total === null) return null;

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

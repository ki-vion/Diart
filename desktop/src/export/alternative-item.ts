import type { LineItem } from "../extractor/models";
import { formatEuroDe } from "./format-money";

const LAIER_ALTERNATIV_TAG = /\(Alternativposition\)/i;
const RK_ALTERNATIVE_HEADER = /Alternativposition\s+zu\s+Position/i;
const KAN_ALTERNATIVE_INTRO = /Als Alternative schlagen wir/i;

/** Layout-independent: Laier, RK/STARK, KAN/IFB alternative positions. */
export function isAlternativeItem(item: Pick<LineItem, "artikel_prefix" | "description">): boolean {
  const text = [item.artikel_prefix, item.description].filter(Boolean).join("\n");
  return (
    LAIER_ALTERNATIV_TAG.test(text) ||
    RK_ALTERNATIVE_HEADER.test(text) ||
    KAN_ALTERNATIVE_INTRO.test(text)
  );
}

/** Parenthesized German euro text for Excel/preview, e.g. "(29,04)". */
export function formatAlternativeGesamtText(gesamt: number): string {
  return `(${formatEuroDe(gesamt)})`;
}

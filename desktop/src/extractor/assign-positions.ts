import type { LineItem } from "./models";

/** Fill empty Position with 1, 2, 3… (e.g. Laier offers without a Pos. column). */
export function assignSequentialPositions(items: LineItem[]): LineItem[] {
  return items.map((it, i) => ({
    ...it,
    position: it.position?.trim() ? it.position : String(i + 1),
  }));
}

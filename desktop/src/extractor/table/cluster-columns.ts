export type WordToken = { text: string; x: number };

/** Split a line's words into cell strings using column boundary x positions. */
export function clusterLineIntoCells(words: WordToken[], columnBoundaries: number[]): string[] {
  if (columnBoundaries.length === 0) {
    return [...words]
      .sort((a, b) => a.x - b.x)
      .map((w) => w.text);
  }

  const sorted = [...words].sort((a, b) => a.x - b.x);
  const cols: string[][] = columnBoundaries.map(() => []);

  for (const w of sorted) {
    let colIdx = 0;
    while (colIdx < columnBoundaries.length - 1 && w.x >= columnBoundaries[colIdx + 1]!) {
      colIdx++;
    }
    cols[colIdx]?.push(w.text);
  }

  return cols.map((parts) => parts.join(" ").trim());
}

/** Derive column boundaries from header word x positions (large horizontal gaps). */
export function inferColumnBoundaries(headerWords: WordToken[], minGap = 25): number[] {
  const xs = headerWords.map((w) => w.x).sort((a, b) => a - b);
  if (xs.length === 0) return [];
  const boundaries: number[] = [xs[0]! - 1];
  for (let i = 1; i < xs.length; i++) {
    if (xs[i]! - xs[i - 1]! >= minGap) {
      boundaries.push((xs[i]! + xs[i - 1]!) / 2);
    }
  }
  return boundaries;
}

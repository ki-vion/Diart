import type { PdfLine } from "../../src/pdf/types.js";
import type { ExploreLineFlags } from "../../src/extractor/table/line-meta.js";

/** One row per logical line — easier than sorting char-level words.tsv by y. */
export function linesToTsv(lines: { y: number; text: string; words: { x: number }[] }[]): string {
  const header = "y\ttext\txMin\txMax\twordCount";
  const rows = lines.map((line) => {
    const xs = line.words.map((w) => w.x);
    const xMin = xs.length ? Math.min(...xs).toFixed(2) : "";
    const xMax = xs.length ? Math.max(...xs).toFixed(2) : "";
    const text = line.text.replace(/\t/g, " ");
    return `${line.y.toFixed(2)}\t${text}\t${xMin}\t${xMax}\t${line.words.length}`;
  });
  return [header, ...rows].join("\n");
}

/** Lines with production table/anchor flags (same as extractAnchoredItems). */
export function linesWithExploreMetaToTsv(
  lines: PdfLine[],
  flags: ExploreLineFlags[],
): string {
  const header = "y\ttext\txMin\txMax\twordCount\tinTable\tisNonItem\tisAnchor\tanchorKind";
  const rows = lines.map((line, i) => {
    const f = flags[i]!;
    const xs = line.words.map((w) => w.x);
    const xMin = xs.length ? Math.min(...xs).toFixed(2) : "";
    const xMax = xs.length ? Math.max(...xs).toFixed(2) : "";
    const text = line.text.replace(/\t/g, " ");
    return [
      line.y.toFixed(2),
      text,
      xMin,
      xMax,
      line.words.length,
      f.inTableRegion ? "1" : "0",
      f.isNonItem ? "1" : "0",
      f.isAnchor ? "1" : "0",
      f.anchorKind ?? "",
    ].join("\t");
  });
  return [header, ...rows].join("\n");
}

export function cellsToTsv(
  lines: PdfLine[],
  lineToCells: (line: PdfLine) => Record<string, string>,
): string {
  const roles = [
    "position",
    "article",
    "description",
    "quantity",
    "unit",
    "unitPrice",
    "lineTotal",
  ] as const;
  const header = ["y", "text", "xMin", "xMax", ...roles].join("\t");
  const rows = lines.map((line) => {
    const xs = line.words.map((w) => w.x);
    const xMin = xs.length ? Math.min(...xs).toFixed(2) : "";
    const xMax = xs.length ? Math.max(...xs).toFixed(2) : "";
    const cells = lineToCells(line);
    const cols = roles.map((r) => (cells[r] ?? "").replace(/\t/g, " "));
    return [line.y.toFixed(2), line.text.replace(/\t/g, " "), xMin, xMax, ...cols].join("\t");
  });
  return [header, ...rows].join("\n");
}

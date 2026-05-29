import type { PdfLine } from "../../src/pdf/types.js";

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

import type { ColumnWindow } from "../pipeline/types";
import type { ColumnRole } from "./header-map";

/** Calibrated from FPF2026234 OCR dump (144 dpi → PDF points). */
export const ECON_FLOOR_WINDOWS: ColumnWindow[] = [
  { role: "position", xMin: 0, xMax: 72 },
  { role: "article", xMin: 72, xMax: 235 },
  { role: "description", xMin: 72, xMax: 235 },
  { role: "quantity", xMin: 278, xMax: 318 },
  { role: "unit", xMin: 318, xMax: 395 },
  { role: "unitPrice", xMin: 395, xMax: 490 },
  { role: "lineTotal", xMin: 490, xMax: 560 },
];

export const ECON_FLOOR_POSITION_RE = /^\d{1,3}\.?$/;
export const ECON_FLOOR_MERGED_POS_ART_RE = /^(\d{1,3})\.(\d{5,8})$/;
export const ECON_FLOOR_ARTICLE_RE = /^\d{4,8}$/;

export function isEconFloorTableEnd(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/Payment\s+Form/i.test(t)) return true;
  if (/Total\s+to\s+be\s+Paid/i.test(t)) return true;
  if (/^Including:/i.test(t)) return true;
  if (/^Total:/i.test(t)) return true;
  return false;
}

export function findEconFloorHeaderIndex(lines: import("../../pdf/types").PdfLine[]): number {
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.text;
    if (/No\.?/i.test(t) && (/Quantity/i.test(t) || /Item/i.test(t))) return i;
  }
  return -1;
}

export function parseEconFloorPositionCell(
  text: string,
): { position: string; article: string | null } | null {
  const t = text.trim().replace(/\s/g, "");
  const merged = ECON_FLOOR_MERGED_POS_ART_RE.exec(t);
  if (merged) return { position: merged[1]!, article: merged[2]! };

  if (ECON_FLOOR_POSITION_RE.test(t)) {
    return { position: t.replace(/\.$/, ""), article: null };
  }
  if (/^\d{1,3}$/.test(t)) return { position: t, article: null };
  return null;
}

export function textInEconFloorWindow(
  line: import("../../pdf/types").PdfLine,
  win: ColumnWindow,
  minOverlap = 0.5,
): string {
  const words = line.words
    .filter((w) => {
      const left = w.x;
      const right = w.x + w.fontSize * 0.45;
      const overlap = Math.min(right, win.xMax) - Math.max(left, win.xMin);
      const width = Math.max(right - left, 0.001);
      return overlap / width >= minOverlap;
    })
    .sort((a, b) => a.x - b.x);
  return words.map((w) => w.text).join(" ").trim();
}

export function econFloorCellsFromLine(
  line: import("../../pdf/types").PdfLine,
  windows: ColumnWindow[] = ECON_FLOOR_WINDOWS,
): Partial<Record<ColumnRole, string>> {
  const out: Partial<Record<ColumnRole, string>> = {};
  for (const win of windows) {
    const t = textInEconFloorWindow(line, win);
    if (!t) continue;
    out[win.role] = out[win.role] ? `${out[win.role]} ${t}` : t;
  }
  return out;
}

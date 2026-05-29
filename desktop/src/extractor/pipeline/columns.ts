import type { PdfLine, PdfPageStructured, PdfWord } from "../../pdf/types";
import type { ColumnRole } from "../table/header-map";
import type { ColumnWindow, RowCells } from "./types";

const ASSIGN_PRIORITY: ColumnRole[] = [
  "lineTotal",
  "unitPrice",
  "quantity",
  "unit",
  "article",
  "position",
  "description",
];

function normalizeHint(s: string): string {
  return s.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
}

export function calibrateColumnWindows(
  pages: PdfPageStructured[],
  headerHints: Partial<Record<ColumnRole, string[]>>,
  fallback: ColumnWindow[],
): ColumnWindow[] {
  const xsByRole: Partial<Record<ColumnRole, number[]>> = {};

  for (const page of pages) {
    for (const line of page.lines) {
      for (const w of line.words) {
        const norm = normalizeHint(w.text);
        for (const role of Object.keys(headerHints) as ColumnRole[]) {
          const hints = headerHints[role];
          if (!hints?.some((h) => norm.includes(normalizeHint(h)))) continue;
          (xsByRole[role] ??= []).push(w.x);
        }
      }
    }
  }

  const roles = Object.keys(xsByRole) as ColumnRole[];
  if (roles.length < 2) return fallback;

  const centers = roles
    .map((role) => {
      const xs = xsByRole[role]!;
      const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
      return { role, x: avg };
    })
    .sort((a, b) => a.x - b.x);

  const windows: ColumnWindow[] = [];
  for (let i = 0; i < centers.length; i++) {
    const left = i === 0 ? 0 : (centers[i - 1]!.x + centers[i]!.x) / 2;
    const right =
      i === centers.length - 1 ? 9999 : (centers[i]!.x + centers[i + 1]!.x) / 2;
    windows.push({ role: centers[i]!.role, xMin: left, xMax: right });
  }

  return windows;
}

function inWindow(w: PdfWord, windows: ColumnWindow[], role: ColumnRole): boolean {
  const win = windows.find((c) => c.role === role);
  return Boolean(win && w.x >= win.xMin && w.x <= win.xMax);
}

function roleForWord(
  w: PdfWord,
  windows: ColumnWindow[],
  catchAllMaxX: number,
): ColumnRole | null {
  const t = w.text.trim();
  if (/^\d{5}$/.test(t) && inWindow(w, windows, "position")) return "position";
  if (/^\d{6,10}$/.test(t) && inWindow(w, windows, "article")) return "article";

  for (const role of ASSIGN_PRIORITY) {
    if (role === "position" || role === "article" || role === "description") continue;
    const win = windows.find((c) => c.role === role);
    if (win && w.x >= win.xMin && w.x <= win.xMax) {
      if (role === "quantity" || role === "unitPrice" || role === "lineTotal") {
        if (/^[\d.,]+$/.test(t) || /EUR/i.test(t)) return role;
      } else {
        return role;
      }
    }
  }

  if (w.x <= catchAllMaxX && !/^[\d.,]+$/.test(t)) return "description";
  if (inWindow(w, windows, "article") && /[A-Za-zÄÖÜäöüß]/.test(t)) return "description";

  return null;
}

export function lineToCells(
  line: PdfLine,
  windows: ColumnWindow[],
  catchAllMaxX = 320,
): RowCells {
  const cells: RowCells = {};

  for (const w of line.words) {
    const role = roleForWord(w, windows, catchAllMaxX);
    if (!role) continue;
    const prev = cells[role] ?? "";
    cells[role] = prev ? `${prev} ${w.text}` : w.text;
  }

  return cells;
}

export function trimCells(cells: RowCells): RowCells {
  const out: RowCells = {};
  for (const [k, v] of Object.entries(cells)) {
    const t = (v ?? "").trim();
    if (t) out[k as ColumnRole] = t;
  }
  return out;
}

import type { PdfLine, PdfPageStructured, PdfWord } from "../../pdf/types";
import { isPlausibleDescriptionLine } from "../table/line-guards";
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

const RK_BILLING_UNIT = /^(ST|M2|SA|FL|PKT|KAR|St|Stück|Stk|kg\/Sa)$/i;
const LAIER_BILLING_UNIT =
  /^(Sack|Stück|Stk\.?|ltr|m²|m2|m|Kanister|Pal\.?|Bund|Rolle?(?:\(n\))?|nr\.?)$/i;

const LEFT_COLUMN_ROLES: ColumnRole[] = ["position", "article", "description"];

function normalizeHint(s: string): string {
  return s.toLowerCase().replace(/\./g, "").replace(/[-–]/g, "").replace(/\s+/g, "");
}

/**
 * RK/STARK: Menge+Preis rechtsbündig — kalibrierte Header-x liefern oft zu schmale
 * Bezeichnungsbänder (ARTIKELBEZEICHNUNG ≈ ARTIKEL-NR.). Links immer Template-Fenster.
 */
function mergeRkColumnWindows(
  _calibrated: ColumnWindow[],
  fallback: ColumnWindow[],
): ColumnWindow[] {
  const out: ColumnWindow[] = [];

  for (const role of LEFT_COLUMN_ROLES) {
    const win = fallback.find((c) => c.role === role);
    if (win) out.push({ ...win });
  }

  const qty = fallback.find((c) => c.role === "quantity");
  const unit = fallback.find((c) => c.role === "unit");
  if (qty) {
    out.push({
      role: "quantity",
      xMin: Math.min(qty.xMin, unit?.xMin ?? qty.xMin),
      xMax: Math.max(qty.xMax, unit?.xMax ?? qty.xMax),
    });
  }

  for (const role of ["unitPrice", "lineTotal"] as ColumnRole[]) {
    const win = fallback.find((c) => c.role === role);
    if (win) out.push({ ...win });
  }

  return out;
}

/** Laier: Fenster aus Kopfzeilen-x (nicht Mittelpunkt-Kalibrierung — Menge ist rechtsbündig). */
function mergeLaierColumnWindows(
  xsByRole: Partial<Record<ColumnRole, number[]>>,
  fallback: ColumnWindow[],
): ColumnWindow[] {
  const headerX = (role: ColumnRole, def: number) => {
    const xs = xsByRole[role];
    if (!xs?.length) {
      const win = fallback.find((c) => c.role === role);
      return win ? (win.xMin + win.xMax) / 2 : def;
    }
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };

  const qtyX = headerX("quantity", 321);
  const unitX = headerX("unit", 353);
  const priceX = headerX("unitPrice", 409);
  const totalX = headerX("lineTotal", 532);
  const artMax = qtyX - 48;

  return [
    { role: "article", xMin: 0, xMax: artMax },
    { role: "description", xMin: 0, xMax: artMax },
    { role: "quantity", xMin: qtyX - 52, xMax: unitX - 10 },
    { role: "unit", xMin: unitX - 14, xMax: priceX - 28 },
    { role: "unitPrice", xMin: priceX - 32, xMax: totalX - 28 },
    { role: "lineTotal", xMin: totalX - 32, xMax: 600 },
  ];
}

export function calibrateColumnWindows(
  pages: PdfPageStructured[],
  headerHints: Partial<Record<ColumnRole, string[]>>,
  fallback: ColumnWindow[],
  layoutId?: string,
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
  if (roles.length < 2) {
    if (layoutId === "RAAB Karcher") return mergeRkColumnWindows(fallback, fallback);
    if (layoutId === "Rudolf Laier GmbH") return mergeLaierColumnWindows(xsByRole, fallback);
    return fallback;
  }

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

  if (layoutId === "RAAB Karcher") {
    return mergeRkColumnWindows(windows, fallback);
  }

  if (layoutId === "Rudolf Laier GmbH") {
    return mergeLaierColumnWindows(xsByRole, fallback);
  }

  return windows;
}

/** VK discount suffix (e.g. „--4 %“) — not part of Artikel/Beschreibung. */
export function isVkDiscountToken(text: string): boolean {
  const t = text.trim();
  return t === "%" || /^--\s*\d+/.test(t);
}

function wordRightX(w: PdfWord): number {
  return w.x + w.fontSize * 0.45;
}

const WINDOW_PAD = 12;

function wordOverlapsWindow(w: PdfWord, win: ColumnWindow): boolean {
  const right = wordRightX(w);
  const xMin = win.xMin - WINDOW_PAD;
  const xMax = win.xMax + WINDOW_PAD;
  return (
    (w.x >= xMin && w.x <= xMax) ||
    (right >= xMin && right <= xMax) ||
    (w.x <= xMin && right >= xMax)
  );
}

function inWindow(w: PdfWord, windows: ColumnWindow[], role: ColumnRole): boolean {
  const win = windows.find((c) => c.role === role);
  return Boolean(win && wordOverlapsWindow(w, win));
}

/** Right-aligned Menge: word must start inside the column, not only overlap via padding. */
function wordStartsInColumn(w: PdfWord, win: ColumnWindow): boolean {
  return w.x >= win.xMin - 2 && w.x <= win.xMax + WINDOW_PAD;
}

function roleForWord(
  w: PdfWord,
  windows: ColumnWindow[],
  catchAllMaxX: number,
): ColumnRole | null {
  const t = w.text.trim();
  if (/^\d{5}$/.test(t) && inWindow(w, windows, "position")) return "position";
  if (/^\d{8}$/.test(t) && inWindow(w, windows, "article")) return "article";
  if (/^\d{6,10}$/.test(t) && inWindow(w, windows, "article")) return "article";

  for (const role of ASSIGN_PRIORITY) {
    if (role === "position" || role === "article" || role === "description") continue;
    const win = windows.find((c) => c.role === role);
    if (!win || !wordOverlapsWindow(w, win)) continue;

    if (role === "quantity") {
      if (/^[\d.,]+$/.test(t) && wordStartsInColumn(w, win)) return "quantity";
      if (RK_BILLING_UNIT.test(t) && wordStartsInColumn(w, win)) return "unit";
      continue;
    }
    if (role === "unit") {
      if (
        (RK_BILLING_UNIT.test(t) || LAIER_BILLING_UNIT.test(t)) &&
        wordStartsInColumn(w, win)
      ) {
        return "unit";
      }
      continue;
    }
    if (role === "unitPrice" || role === "lineTotal") {
      if (/^[\d.,]+$/.test(t) || /EUR/i.test(t)) return role;
      continue;
    }
  }

  if (w.x <= catchAllMaxX) {
    const qtyWin = windows.find((c) => c.role === "quantity");
    const inQtyColumn = qtyWin && wordStartsInColumn(w, qtyWin);
    if (!/^[\d.,]+$/.test(t) || !inQtyColumn) return "description";
  }
  if (inWindow(w, windows, "article") && /[A-Za-zÄÖÜäöüß]/.test(t)) return "description";

  return null;
}

export function lineToCells(
  line: PdfLine,
  windows: ColumnWindow[],
  catchAllMaxX = 320,
): RowCells {
  const trimmed = line.text.trim();
  if (/^Alternativposition\s+zu\s+Position/i.test(trimmed)) {
    return { description: trimmed };
  }

  const cells: RowCells = {};
  const assigned = new Set<PdfWord>();

  for (const w of line.words) {
    const role = roleForWord(w, windows, catchAllMaxX);
    if (!role) continue;
    assigned.add(w);
    const prev = cells[role] ?? "";
    cells[role] = prev ? `${prev} ${w.text}` : w.text;
  }

  const leftover = line.words
    .filter((w) => !assigned.has(w) && !isVkDiscountToken(w.text))
    .map((w) => w.text)
    .join(" ")
    .trim();
  if (
    leftover &&
    !isVkDiscountToken(leftover) &&
    isPlausibleDescriptionLine(line, windows)
  ) {
    const prev = cells.description ?? "";
    cells.description = prev ? `${prev} ${leftover}`.trim() : leftover;
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

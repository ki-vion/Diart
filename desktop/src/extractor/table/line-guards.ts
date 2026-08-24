import type { PdfLine, PdfWord } from "../../pdf/types";
import type { ColumnWindow } from "../pipeline/types";
import { isPageImprintLine, isPostTableText } from "./table-zone";

const BILLING_ROLES = ["quantity", "unit", "unitPrice", "lineTotal"] as const;
const PRICE_ROLES = ["unitPrice", "lineTotal"] as const;

export function wordRightX(w: PdfWord): number {
  return w.x + w.fontSize * 0.45;
}

/** Share of words whose midpoint lies mostly inside [xMin, xMax]. */
export function lineBandOverlapRatio(
  line: PdfLine,
  band: { xMin: number; xMax: number },
  minWordOverlap = 0.5,
): number {
  if (!line.words.length) return 0;
  let matched = 0;
  for (const w of line.words) {
    const left = w.x;
    const right = wordRightX(w);
    const overlap = Math.min(right, band.xMax) - Math.max(left, band.xMin);
    const width = Math.max(right - left, 0.001);
    if (overlap / width >= minWordOverlap) matched++;
  }
  return matched / line.words.length;
}

/**
 * Left / article / description band — everything left of billing columns.
 * RK/STARK: Bezeichnung kann bis nahe Menge reichen (x≈250); nicht an qty.xMin abschneiden,
 * wenn das Beschreibungsfenster ohnehin breit ist.
 */
export function getLeftTextBand(windows: ColumnWindow[]): { xMin: number; xMax: number } {
  const qty = windows.find((w) => w.role === "quantity");
  const desc = windows.find((w) => w.role === "description");
  const art = windows.find((w) => w.role === "article");
  const descMax = desc?.xMax ?? art?.xMax ?? 320;
  const wideDesc = qty !== undefined && descMax >= qty.xMin - 32;
  const xMax = wideDesc
    ? descMax + 24
    : qty
      ? Math.min(qty.xMin - 8, descMax + 24)
      : descMax + 24;
  return { xMin: 0, xMax: Math.max(xMax, 120) };
}

export function getLeftTextBandFromBoundaries(boundaries: number[]): {
  xMin: number;
  xMax: number;
} {
  if (boundaries.length < 2) return { xMin: 0, xMax: 320 };
  return { xMin: 0, xMax: boundaries[1]! };
}

function countRoleBandOverlaps(
  line: PdfLine,
  windows: ColumnWindow[],
  roles: readonly ColumnWindow["role"][],
  minRatio = 0.35,
): number {
  let count = 0;
  for (const role of roles) {
    const win = windows.find((w) => w.role === role);
    if (win && lineBandOverlapRatio(line, win) >= minRatio) count++;
  }
  return count;
}

export function countBillingBandOverlaps(
  line: PdfLine,
  windows: ColumnWindow[],
  minRatio = 0.35,
): number {
  return countRoleBandOverlaps(line, windows, BILLING_ROLES, minRatio);
}

/** Option B: description only when a meaningful share of words sits in the left text band. */
export function isPlausibleDescriptionLine(
  line: PdfLine,
  windows: ColumnWindow[],
  minLeftRatio = 0.4,
): boolean {
  const text = line.text.trim();
  if (!text) return false;
  if (isBlockTerminatorLine(text)) return false;

  const leftRatio = lineBandOverlapRatio(line, getLeftTextBand(windows));
  if (leftRatio >= minLeftRatio) return true;

  const billingBands = countBillingBandOverlaps(line, windows);
  if (billingBands >= 2 && leftRatio < 0.25) return false;

  return false;
}

export function isPlausibleDescriptionLineByBoundaries(
  line: PdfLine,
  boundaries: number[],
  minLeftRatio = 0.4,
): boolean {
  const text = line.text.trim();
  if (!text) return false;
  if (isBlockTerminatorLine(text)) return false;
  return lineBandOverlapRatio(line, getLeftTextBandFromBoundaries(boundaries)) >= minLeftRatio;
}

const HARD_TABLE_END_EXTRA =
  /^(Total\s+EUR|Total\s+inkl|Total\s+ohne|Zahlungsbedingung|Lieferbedingung|Es gelten unsere|Die mit \*|Mit freundlichen Grüßen|Auftragserteilung|Unser Angebot)/i;

export function isHardTableEndLine(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isPostTableText(t)) return true;
  return HARD_TABLE_END_EXTRA.test(t);
}

export function isBlockTerminatorLine(text: string): boolean {
  return isHardTableEndLine(text);
}

/**
 * Footer rows that span VK-Preis + Betrag without article text.
 * Menge/Einheit on adjacent columns (e.g. "57" + "Sack") must not end the block.
 */
export function shouldStopBlockAtLine(line: PdfLine, windows: ColumnWindow[]): boolean {
  const text = line.text.trim();
  if (!text) return false;
  if (isBlockTerminatorLine(text)) return true;

  const leftRatio = lineBandOverlapRatio(line, getLeftTextBand(windows));
  if (leftRatio >= 0.25) return false;

  // Single Pos-Wert in the Betrag column must not end the block (overlaps Einzelpreis band via padding).
  if (line.words.length === 1 && /^[\d.,]+$/.test(text)) return false;

  const priceBands = countRoleBandOverlaps(line, windows, PRICE_ROLES);
  return priceBands >= 2;
}

export function trimBlockLines(
  lines: PdfLine[],
  options?: { windows?: ColumnWindow[]; pageHeight?: number },
): PdfLine[] {
  const pageHeight = options?.pageHeight ?? 842;
  const out: PdfLine[] = [];
  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;
    if (isPageImprintLine(line, pageHeight)) break;
    if (isBlockTerminatorLine(text)) break;
    if (options?.windows?.length && shouldStopBlockAtLine(line, options.windows)) break;
    out.push(line);
  }
  return out;
}

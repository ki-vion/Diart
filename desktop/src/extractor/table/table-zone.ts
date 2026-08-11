import type { PdfLine } from "../../pdf/types";

/** Summary / legal text after the item table (layout-agnostic). */
const GENERIC_POST_TABLE =
  /^(Gewicht|Nettowert|Zahlungsbedingungen|Gesamtbetrag|Gesamt\s|Zwischensumme|Summe|Endsumme|MwSt\.?|USt\.|Brutto|Zahlungsziel|Total\s+EUR)/i;

const RK_POST_TABLE =
  /Gewicht\s*Brutto|DerGesamtbetrag|WirmöchtenSiedarauf|www\.stark-deutschland|MitfreundlichenGrüßen/i;

/** Letterhead on continuation pages — not the column header row (POS. + ARTIKEL-NR). */
const PAGE_HEADER =
  /^(Gedruckt am|Seite\s+\d|ANGEBOT\b|Kunden-Nr\.|Besteller\b|Ihr\s+Sachbearbeiter)/i;

const IMPRINT =
  /Raab\s*Karcher|STARK\s*Deutschland|Hafeninsel|Geschäftsführ|Bankverbindung|IBAN\s*DE|aufbewahrungspflichtig|www\.raabkarcher/i;

/** Still part of a position (not table end). */
const TABLE_CONTINUATION = /^Alternativposition/i;

export function isPostTableText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (TABLE_CONTINUATION.test(t)) return false;
  if (/^_{3,}$/.test(t.replace(/\s/g, ""))) return true;
  if (GENERIC_POST_TABLE.test(t)) return true;
  if (RK_POST_TABLE.test(t)) return true;
  return false;
}

export function isPageHeaderText(text: string): boolean {
  return PAGE_HEADER.test(text.trim());
}

export function lineXMin(line: PdfLine): number {
  const xs = line.words.map((w) => w.x);
  return xs.length ? Math.min(...xs) : 0;
}

export function lineAvgFontSize(line: PdfLine): number {
  const sizes = line.words.map((w) => w.fontSize);
  if (!sizes.length) return 10;
  return sizes.reduce((a, b) => a + b, 0) / sizes.length;
}

/** Page imprint (small type, bottom band) or repeating letterhead. */
export function isPageImprintLine(line: PdfLine, pageHeight: number): boolean {
  const text = line.text.trim();
  if (!text) return true;

  const font = lineAvgFontSize(line);
  const xMin = lineXMin(line);
  const smallType = font <= 6.75;
  const bottomBand = line.y >= pageHeight * 0.88;
  if (bottomBand && smallType && xMin > 90) return true;

  const topBand = line.y <= pageHeight * 0.22;
  if (topBand && smallType && (IMPRINT.test(text) || PAGE_HEADER.test(text))) {
    return true;
  }

  return false;
}

/** Line must not be grouped into a position block or table body. */
export function isNonItemLine(line: PdfLine, pageHeight: number): boolean {
  const text = line.text.trim();
  if (!text) return false;
  if (isPostTableText(text)) return true;
  if (isPageHeaderText(text)) return true;
  if (IMPRINT.test(text)) return true;
  if (/^\d{6,8}\s+\d{2}\.\d{2}\.\d{4}$/.test(text)) return true;
  if (isPageImprintLine(line, pageHeight)) return true;
  return false;
}

/** German display: 11.623,41 */
const euroFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

/** German display for quantities: 1.100 or 1,5 */
const quantityFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
  useGrouping: true,
});

export function formatEuroDe(value: number): string {
  return euroFormatter.format(value);
}

export function formatQuantityDe(value: number): string {
  return quantityFormatter.format(value);
}

/**
 * Locale-neutral Excel format code. German Excel displays this as 21.510,48.
 * Do not use `#.##0,00` — Excel treats `.`/`,` in the US sense and shows wrong decimals.
 */
export const EXCEL_EURO_NUMFMT = "#,##0.00";

/** Whole quantities (German display e.g. 43 or 1.100) — no trailing decimal comma. */
export const EXCEL_QUANTITY_INTEGER_NUMFMT = "#,##0";

/** Quantities with fraction digits (German display e.g. 43,2 or 2,6). */
export const EXCEL_QUANTITY_NUMFMT = "#,##0.###";

const MAX_QUANTITY_DECIMALS = 3;

/** Pick integer vs fractional Excel format (avoids "43," for whole numbers in de-DE Excel). */
export function excelQuantityNumFmt(value: number): string {
  const factor = 10 ** MAX_QUANTITY_DECIMALS;
  const rounded = Math.round(value * factor) / factor;
  return Number.isInteger(rounded)
    ? EXCEL_QUANTITY_INTEGER_NUMFMT
    : EXCEL_QUANTITY_NUMFMT;
}

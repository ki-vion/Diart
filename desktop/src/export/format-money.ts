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

/** Quantities with optional fraction digits (German display e.g. 1.100 or 1,5). */
export const EXCEL_QUANTITY_NUMFMT = "#,##0.###";

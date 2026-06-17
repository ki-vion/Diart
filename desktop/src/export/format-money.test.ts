import { describe, expect, it } from "vitest";
import {
  excelQuantityNumFmt,
  EXCEL_QUANTITY_INTEGER_NUMFMT,
  EXCEL_QUANTITY_NUMFMT,
  formatEuroDe,
  formatQuantityDe,
} from "./format-money";

describe("formatEuroDe", () => {
  it("formats with German thousands separator and 2 decimals", () => {
    expect(formatEuroDe(11623.41)).toBe("11.623,41");
    expect(formatEuroDe(12)).toBe("12,00");
  });
});

describe("formatQuantityDe", () => {
  it("formats large quantities with grouping", () => {
    expect(formatQuantityDe(1100)).toBe("1.100");
  });
});

describe("excelQuantityNumFmt", () => {
  it("uses integer format for whole numbers", () => {
    expect(excelQuantityNumFmt(43)).toBe(EXCEL_QUANTITY_INTEGER_NUMFMT);
    expect(excelQuantityNumFmt(1100)).toBe(EXCEL_QUANTITY_INTEGER_NUMFMT);
  });

  it("uses fractional format when decimals are present", () => {
    expect(excelQuantityNumFmt(2.6)).toBe(EXCEL_QUANTITY_NUMFMT);
    expect(excelQuantityNumFmt(43.2)).toBe(EXCEL_QUANTITY_NUMFMT);
  });
});

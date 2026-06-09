import { describe, expect, it } from "vitest";
import { formatEuroDe, formatQuantityDe } from "./format-money";

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

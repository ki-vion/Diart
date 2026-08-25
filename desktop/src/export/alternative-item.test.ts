import { describe, expect, it } from "vitest";
import { formatAlternativeGesamtText, isAlternativeItem } from "./alternative-item";

describe("isAlternativeItem", () => {
  it("detects Laier (Alternativposition) in description", () => {
    expect(
      isAlternativeItem({
        artikel_prefix: null,
        description: "(Alternativposition)\nSockeldämmplatte",
      }),
    ).toBe(true);
  });

  it("detects RK Alternativposition prefix", () => {
    expect(
      isAlternativeItem({
        artikel_prefix: "Alternativposition zu Position 0010",
        description: "9800928\nZaunpfahl",
      }),
    ).toBe(true);
  });

  it("detects KAN/IFB alternative intro", () => {
    expect(
      isAlternativeItem({
        artikel_prefix: "Als Alternative schlagen wir\nfolgenden Artikel vor:",
        description: "0206050001\nweber.star",
      }),
    ).toBe(true);
  });

  it("returns false for normal positions", () => {
    expect(
      isAlternativeItem({
        artikel_prefix: null,
        description: "Silikatfarbe außen 15 ltr weiß",
      }),
    ).toBe(false);
  });
});

describe("formatAlternativeGesamtText", () => {
  it("wraps formatted euro in parentheses", () => {
    expect(formatAlternativeGesamtText(29.04)).toBe("(29,04)");
    expect(formatAlternativeGesamtText(1234.5)).toBe("(1.234,50)");
  });
});

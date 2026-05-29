import { describe, expect, it } from "vitest";
import { extractFromLines } from "./rk_stark";

describe("rk_stark extractFromLines", () => {
  it("extracts multi-line RK blocks", () => {
    const lines = [
      "STARK Deutschland",
      "00010 249706",
      "<B>",
      "Fermacell Powerpanel",
      "10",
      "St",
      "12,34",
      "EUR/1 ST",
      "123,40",
      "Zusatztext zur Beschreibung",
    ];

    const result = extractFromLines(lines, "RK - Fermacell.pdf");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.position).toBe("00010");
    expect(result.items[0]?.article_number).toBe("249706");
    expect(result.items[0]?.quantity).toBe(10);
    expect(result.items[0]?.unit_price).toBe(12.34);
    expect(result.items[0]?.line_total).toBe(123.4);
    expect(result.items[0]?.description).toContain("Fermacell");
    expect(result.items[0]?.description).toContain("Zusatztext");
  });
});


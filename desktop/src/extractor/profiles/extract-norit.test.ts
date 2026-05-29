import { describe, expect, it } from "vitest";
import { extractNoritFromLines } from "./extract-norit";

describe("extractNoritFromLines", () => {
  it("parses real Norit field order (qty, pos, net, then details)", () => {
    const lines = [
      "Rechnungsnummer:",
      "Einzelpreis",
      "Pos",
      "Menge",
      "50 St",
      "120",
      "1.217,70 EUR",
      "TE 25 Therm GF-U 150-15",
      "27,000 m²",
      "45,10 EUR /m²",
      "00114328",
      "50 St",
      "130",
      "753,30 EUR",
      "TE 25 Therm GF-E 150-15",
      "27,000 m²",
      "27,90 EUR /m²",
      "00114339",
    ];

    const result = extractNoritFromLines(lines, "Norit Rechnung.pdf");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.position).toBe("120");
    expect(result.items[0]?.line_total).toBe(1217.7);
    expect(result.items[0]?.quantity).toBe(27);
    expect(result.items[0]?.unit_price).toBe(45.1);
    expect(result.items[1]?.position).toBe("130");
    expect(result.items[1]?.line_total).toBe(753.3);
  });
});

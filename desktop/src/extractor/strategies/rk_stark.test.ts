import { describe, expect, it } from "vitest";
import { extractFromLines } from "./rk_stark";

describe("RkStarkStrategy.extractFromLines", () => {
  it("extracts a row-like line and appends continuation", () => {
    const lines = [
      "STARK Deutschland",
      "1 330240 Fermacell Powerpanel 10,0 St 12,34 EUR 123,40",
      "Zusatztext zur Beschreibung",
    ];

    expect(extractFromLines(lines, "RK - Fermacell.pdf")).toEqual({
      layout_id: "rk_stark",
      source_pdf: "RK - Fermacell.pdf",
      items: [
        {
          position: "1",
          article_number: "330240",
          description: "Fermacell Powerpanel Zusatztext zur Beschreibung",
          quantity: 10,
          unit: "St",
          unit_price: 12.34,
          line_total: 123.4,
        },
      ],
    });
  });
});


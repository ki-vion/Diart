import { describe, expect, it } from "vitest";
import { extractFromLines } from "./norit_rechnung";

describe("NoritRechnungStrategy.extractFromLines", () => {
  it("extracts position, net total, qty and article number", () => {
    const lines = [
      "Rechnungsnummer:",
      "Einzelpreis",
      "001",
      "1.217,00 EUR",
      "12345678",
      "2,0 St",
      "10,00 EUR / St",
      "Some item description",
      "002",
      "12,00 EUR",
      "87654321",
      "1 St",
      "12,00 EUR / St",
      "Other item",
    ];

    expect(extractFromLines(lines, "Norit Rechnung.pdf")).toEqual({
      layout_id: "norit_rechnung",
      source_pdf: "Norit Rechnung.pdf",
      items: [
        {
          position: "001",
          article_number: "12345678",
          description: "Some item description",
          quantity: 2,
          unit: "St",
          unit_price: 10,
          line_total: 1217,
        },
        {
          position: "002",
          article_number: "87654321",
          description: "Other item",
          quantity: 1,
          unit: "St",
          unit_price: 12,
          line_total: 12,
        },
      ],
    });
  });
});


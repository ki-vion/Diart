import { describe, expect, it } from "vitest";
import { extractFromLines } from "./kan_ifb";

describe("kan_ifb extractFromLines", () => {
  it("extracts items from KAN IFB-like lines", () => {
    const lines = [
      "ANGEBOT",
      "foo",
      "001 Artikelnummer: 0206050001",
      "80",
      "l",
      "2,76",
      "220,80",
      "weber.prim 400",
      "Tiefgrund",
      "Übertrag",
      "002 Artikelnummer: ABC-123",
      "1",
      "Stk",
      "10,00",
      "10,00",
      "Some item",
      "Betrag EUR",
    ];

    expect(extractFromLines(lines, "KAN Angebot.pdf")).toEqual({
      layout_id: "kan_ifb",
      source_pdf: "KAN Angebot.pdf",
      items: [
        {
          position: "001",
          article_number: "0206050001",
          description: "weber.prim 400 Tiefgrund",
          quantity: 80,
          unit: "l",
          unit_price: 2.76,
          line_total: 220.8,
        },
        {
          position: "002",
          article_number: "ABC-123",
          description: "Some item",
          quantity: 1,
          unit: "Stk",
          unit_price: 10,
          line_total: 10,
        },
      ],
    });
  });
});


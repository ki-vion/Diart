import { describe, expect, it } from "vitest";
import { extractFromLines } from "./laier_van";

describe("laier_van extractFromLines", () => {
  it("extracts sequential positions for article rows", () => {
    const lines = [
      "VK-Preis",
      "Rudolf Laier",
      "33011303",
      "Fugenmörtel",
      "57 Sack",
      "11,85",
      "675,45",
      "12345678",
      "Other item",
      "1 Stk",
      "10,00",
      "10,00",
    ];

    expect(extractFromLines(lines, "Verkauf - Angebot_VAN029183.pdf")).toEqual({
      layout_id: "laier_van",
      source_pdf: "Verkauf - Angebot_VAN029183.pdf",
      items: [
        {
          position: "1",
          article_number: "33011303",
          description: "Fugenmörtel",
          quantity: 57,
          unit: "Sack",
          unit_price: 11.85,
          line_total: 675.45,
        },
        {
          position: "2",
          article_number: "12345678",
          description: "Other item",
          quantity: 1,
          unit: "Stk",
          unit_price: 10,
          line_total: 10,
        },
      ],
    });
  });
});


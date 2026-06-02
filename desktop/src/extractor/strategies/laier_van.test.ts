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
      "R000008 *",
      "Maut",
      "1 Stück",
      "31,64",
      "31,64",
    ];

    const result = extractFromLines(lines, "Verkauf - Angebot_VAN029183.pdf");
    expect(result.layout_id).toBe("Rudolf Laier GmbH");
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toMatchObject({
      position: "1",
      article_number: "33011303",
      description: "Fugenmörtel",
      quantity: 57,
      unit: "Sack",
      unit_price: 11.85,
      line_total: 675.45,
    });
  });
});


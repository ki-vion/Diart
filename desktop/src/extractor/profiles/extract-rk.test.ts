import { describe, expect, it } from "vitest";
import { parseRkBlock } from "./extract-rk";

describe("parseRkBlock", () => {
  it("parses multi-line STARK/Raab Karcher position block", () => {
    const item = parseRkBlock([
      "00010 249706",
      "<B>",
      "Fermacell Estrich-Wabe",
      "105",
      "= 70",
      "M2",
      "ST",
      "13,38",
      "EUR/1 M2",
      "1.404,90",
    ]);

    expect(item?.position).toBe("00010");
    expect(item?.article_number).toBe("249706");
    expect(item?.quantity).toBe(105);
    expect(item?.unit_price).toBe(13.38);
    expect(item?.line_total).toBe(1404.9);
    expect(item?.description).toContain("Fermacell");
  });

  it("stops description at footer imprint text", () => {
    const item = parseRkBlock([
      "00040 1040847",
      "5",
      "SA",
      "4,00",
      "EUR/1 SA",
      "20,00",
      "RAW Betonestrich fein",
      "Körn.4mm30kg/Sa",
      "GewichtBrutto 400,054KG Nettowert: 2.859,50",
      "Raab Karcher - eine Marke der STARK Deutschland GmbH",
    ]);

    expect(item?.description).toContain("RAW Betonestrich");
    expect(item?.description).not.toMatch(/Raab Karcher/i);
  });

  it("parses MuPDF-style merged anchor line (no spaces)", () => {
    const item = parseRkBlock([
      "000109802917 <B> 29ST 66,70EUR/1ST",
      "Doppelstabmatte schwere Ausführung 1.934,30",
      "2508x1830 mm, feuerverzinkt",
    ]);

    expect(item?.position).toBe("00010");
    expect(item?.article_number).toBe("9802917");
    expect(item?.quantity).toBe(29);
    expect(item?.unit_price).toBe(66.7);
    expect(item?.line_total).toBe(1934.3);
  });
});

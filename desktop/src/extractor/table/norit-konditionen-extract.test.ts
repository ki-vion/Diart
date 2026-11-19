import { describe, expect, it } from "vitest";
import type { PdfLine, PdfStructured } from "../../pdf/types";
import { extractNoritKonditionenItems } from "./norit-konditionen-extract";
import { extractNoritKonditionen } from "../profiles/extract-norit-konditionen";

function frag(text: string, x: number, y: number): PdfLine {
  return { y, text, words: [{ text, x, y, fontSize: 8 }] };
}

function page(lines: PdfLine[]): PdfStructured {
  return {
    sourceFileName: "konditionen.pdf",
    pages: [{ index: 0, width: 595, height: 842, rawText: "", lines }],
  };
}

const TONNAGE_HEADER = [
  frag("NORIT-Trockenestrich", 61, 304),
  frag("Teilenr.", 59, 326),
  frag("Teilebezeichnung", 107, 326),
  frag("Nettopreis", 380, 326),
  frag("ab 5 t", 285, 339),
  frag("ab 12 t", 354, 339),
  frag("ab 24 t", 426, 339),
  frag("bei Abholung", 482, 339),
];

describe("extractNoritKonditionenItems", () => {
  it("keeps only ab 5 t / ab 12 t and tags the section", () => {
    const items = extractNoritKonditionenItems(
      page([
        ...TONNAGE_HEADER,
        frag("110554", 68, 350),
        frag("NORIT-TE 15", 107, 350),
        frag("15,50 EUR/m²", 271, 350),
        frag("15,05 EUR/m²", 343, 350),
        frag("14,60 EUR/m²", 415, 350),
        frag("14,14 EUR/m²", 485, 350),
      ]),
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      article_number: "110554",
      description: "NORIT-TE 15",
      unit: "m²",
      unit_price: 15.5,
      section: "NORIT-Trockenestrich",
      tier_prices: [
        { label: "ab 5 t", price: 15.5 },
        { label: "ab 12 t", price: 15.05 },
      ],
    });
  });

  it("spreads a merged tonnage price over ab 5 t and ab 12 t, ignoring Abholung", () => {
    const items = extractNoritKonditionenItems(
      page([
        ...TONNAGE_HEADER,
        frag("600515", 68, 471),
        frag("NORIT-Heizrohr - 90 Meter", 107, 471),
        frag("0,82 EUR/lfm", 343, 471),
        frag("0,79 EUR/lfm", 485, 471),
      ]),
    );
    expect(items[0]?.tier_prices).toEqual([
      { label: "ab 5 t", price: 0.82 },
      { label: "ab 12 t", price: 0.82 },
    ]);
  });

  it("takes Nettopreis frei Haus and drops Nettopreis bei Abholung", () => {
    const items = extractNoritKonditionenItems(
      page([
        frag("NORIT-Schüttung und Zubehör", 61, 125),
        frag("Teilenr.", 59, 143),
        frag("Teilebezeichnung", 107, 143),
        frag("Nettopreis frei Haus", 288, 143),
        frag("Nettopreis bei Abholung", 421, 143),
        frag("600525", 69, 162),
        frag("NORIT-Trockenschüttung *1", 107, 162),
        frag("10,16 EUR/Sack", 302, 162),
        frag("9,86 EUR/Sack", 446, 162),
      ]),
    );
    expect(items[0]).toMatchObject({
      section: "NORIT-Schüttung und Zubehör",
      unit_price: 10.16,
      tier_prices: [{ label: "Nettopreis frei Haus", price: 10.16 }],
    });
  });

  it("keeps service rows without article numbers", () => {
    const { items } = extractNoritKonditionen(
      page([
        frag("Dienstleistung", 60, 317),
        frag("Nettopreis", 381, 317),
        frag("Verlegeplan ohne Auslegungsberechnung", 60, 331),
        frag("2,00 EUR/m²", 381, 331),
      ]),
      "konditionen.pdf",
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      position: "1",
      article_number: null,
      unit_price: 2,
      section: "Dienstleistung",
      tier_prices: [{ label: "Nettopreis", price: 2 }],
    });
  });
});

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
  frag("Teilenr.", 59, 326),
  frag("Teilebezeichnung", 107, 326),
  frag("Nettopreis", 380, 326),
  frag("ab 5 t", 285, 339),
  frag("ab 12 t", 354, 339),
  frag("ab 24 t", 426, 339),
  frag("bei Abholung", 482, 339),
];

describe("extractNoritKonditionenItems", () => {
  it("uses the ab 5 t price with quantity 1", () => {
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
      quantity: 1,
      unit: "m²",
      unit_price: 15.5,
      line_total: 15.5,
    });
  });

  it("falls back to the next tonnage column, never bei Abholung", () => {
    const items = extractNoritKonditionenItems(
      page([
        ...TONNAGE_HEADER,
        frag("600515", 68, 471),
        frag("NORIT-Heizrohr - 90 Meter", 107, 471),
        frag("0,82 EUR/lfm", 343, 471),
        frag("0,79 EUR/lfm", 485, 471),
        frag("999999", 68, 483),
        frag("Nur Abholung", 107, 483),
        frag("1,00 EUR/St.", 485, 483),
      ]),
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.unit_price).toBe(0.82);
    expect(items[0]?.unit).toBe("lfm");
  });

  it("takes Nettopreis frei Haus and ignores Nettopreis bei Abholung", () => {
    const items = extractNoritKonditionenItems(
      page([
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
    expect(items[0]).toMatchObject({ unit_price: 10.16, unit: "Sack", quantity: 1 });
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
      quantity: 1,
      unit_price: 2,
    });
  });
});

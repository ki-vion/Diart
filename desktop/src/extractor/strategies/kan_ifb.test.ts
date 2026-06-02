import { describe, expect, it } from "vitest";
import { formatArtikelCell } from "../../export/format-artikel";
import { extractFromLines } from "./kan_ifb";
import { extractAnchoredItems } from "../table/anchor-extract";
import { parseKanBlock } from "../table/kan-block";
import type { PdfLine } from "../../pdf/types";

function textLine(y: number, text: string): PdfLine {
  return { y, text, words: [{ text, x: 42, y, fontSize: 10 }] };
}

describe("kan_ifb extractFromLines", () => {
  it("extracts items from merged KAN anchor line", () => {
    const lines = [
      "ANGEBOT",
      "001 Artikelnummer: 0206050001",
      "80",
      "l",
      "2,76",
      "220,80",
      "weber.prim 400",
      "Tiefgrund",
      "002 Artikelnummer: ABC-123",
      "1",
      "Stk",
      "10,00",
      "10,00",
      "Some item",
    ];

    const result = extractFromLines(lines, "KAN Angebot.pdf");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.position).toBe("001");
    expect(result.items[0]?.description).toContain("weber.prim 400");
  });

  it("extracts items when position and Artikelnummer are on separate lines", () => {
    const lines = [
      "Pos. Bezeichnung",
      "001",
      "Artikelnummer: 0206050001",
      "80,000",
      "l",
      "2,76",
      "220,80",
      "weber.prim 400 Tiefgrund",
      "10l/Eimer",
      "002",
      "Artikelnummer: 0206050041",
      "23,040",
      "qm",
      "35,81",
      "825,06",
      "weber.therm RS 021",
    ];

    const result = extractFromLines(lines, "KAN.pdf");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.article_number).toBe("0206050001");
    expect(result.items[0]?.quantity).toBe(80);
    expect(result.items[1]?.position).toBe("002");
  });
});

describe("extractAnchoredItems (KAN split lines)", () => {
  it("finds anchors and parses KAN page slice", () => {
    const lines = [
      textLine(410, "Pos."),
      textLine(410, "Bezeichnung"),
      textLine(410, "Menge"),
      textLine(410, "ME"),
      textLine(410, "E.-Preis"),
      textLine(410, "Betrag EUR"),
      textLine(426, "001"),
      textLine(426, "Artikelnummer: 0206050001"),
      textLine(426, "80,000"),
      textLine(426, "l"),
      textLine(426, "2,76"),
      textLine(426, "220,80"),
      textLine(438, "weber.prim 400 Tiefgrund"),
    ];

    const structured = {
      pages: [{ index: 0, width: 595, height: 842, rawText: "", lines }],
    };

    const items = extractAnchoredItems(structured, "IFB GmbH");
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0]?.position).toBe("001");
    expect(items[0]?.unit_price).toBe(2.76);
  });
});

describe("KAN artikel column", () => {
  it("skips standalone alternativ marker in description", () => {
    const item = parseKanBlock([
      textLine(100, "002 Artikelnummer: 0206050001"),
      textLine(110, "1"),
      textLine(120, "St"),
      textLine(130, "10,00"),
      textLine(140, "10,00"),
      textLine(150, "weber.star 224"),
      textLine(160, "alternativ"),
      textLine(170, "weiß, 25/Sack"),
    ]);
    expect(item?.description).toBe("weber.star 224\nweiß, 25/Sack");
    expect(
      formatArtikelCell(item!, { layoutId: "IFB GmbH" }),
    ).toBe("Artikelnummer: 0206050001\nweber.star 224\nweiß, 25/Sack");
  });
});

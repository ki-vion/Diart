import { describe, expect, it } from "vitest";
import type { PdfLine } from "../../pdf/types";
import {
  findTableEndIndex,
  findTableRegion,
  isValidTableHeader,
  lineFitsTableGrid,
} from "./table-region";

function line(y: number, parts: Array<{ text: string; x: number; fontSize?: number }>): PdfLine {
  const words = parts.map((p) => ({
    text: p.text,
    x: p.x,
    y,
    fontSize: p.fontSize ?? 10,
  }));
  return { y, words, text: words.map((w) => w.text).join(" ") };
}

describe("isValidTableHeader", () => {
  it("accepts tables without a line-total column", () => {
    expect(
      isValidTableHeader(
        { position: 0, description: 1, quantity: 2, unit: 3, unitPrice: 4 },
        4,
      ),
    ).toBe(true);
  });

  it("rejects header with only one mapped role", () => {
    expect(isValidTableHeader({ position: 0 }, 2)).toBe(false);
  });
});

describe("findTableEndIndex", () => {
  it("stops before post-table summary lines", () => {
    const lines: PdfLine[] = [
      line(200, [{ text: "00040", x: 42 }, { text: "1040847", x: 100 }]),
      line(220, [{ text: "Produkt", x: 76 }]),
      line(300, [{ text: "GewichtBrutto", x: 42 }, { text: "400KG", x: 200 }]),
      line(320, [{ text: "Zahlungsbedingungen", x: 42 }]),
    ];
    const end = findTableEndIndex({ lines, height: 842 }, 0, [40, 120, 280, 400], {
      position: 0,
      description: 1,
    });
    expect(end).toBe(2);
  });
});

describe("findTableRegion", () => {
  it("detects header without Betrag column", () => {
    const lines: PdfLine[] = [
      line(100, [
        { text: "Pos", x: 40 },
        { text: "Bezeichnung", x: 120 },
        { text: "Menge", x: 300 },
        { text: "Preis", x: 420 },
      ]),
      line(120, [
        { text: "001", x: 40 },
        { text: "Schraube", x: 120 },
        { text: "2", x: 300 },
        { text: "10,00", x: 420 },
      ]),
    ];
    const region = findTableRegion({ lines, height: 800 });
    expect(region).not.toBeNull();
    expect(region?.columnMap.lineTotal).toBeUndefined();
    expect(region?.columnMap.unitPrice).toBeDefined();
    expect(region?.dataStartIndex).toBe(1);
  });
});

describe("lineFitsTableGrid", () => {
  it("rejects full-width prose below the grid", () => {
    const prose = line(400, [{ text: "WirmöchtenSiedaraufhinweisen", x: 10 }]);
    expect(lineFitsTableGrid(prose, [40, 120, 300, 420], {})).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import type { PdfLine } from "../../pdf/types";
import {
  findTableEndIndex,
  findTableRegion,
  findTableRegionOrContinuation,
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
  it("skips letterhead lines before the first position anchor", () => {
    const lines: PdfLine[] = [
      line(100, [{ text: "Gedruckt am", x: 280, fontSize: 8 }]),
      line(110, [{ text: "Seite 3 / 4", x: 490, fontSize: 8 }]),
      line(200, [{ text: "00010", x: 42 }, { text: "9802917", x: 76 }]),
      line(220, [{ text: "Produkt", x: 76 }]),
    ];
    const end = findTableEndIndex({ lines, height: 842 }, 0, [], {});
    expect(end).toBe(lines.length);
  });

  it("skips separator lines before the first position anchor", () => {
    const lines: PdfLine[] = [
      line(180, [{ text: "POS.", x: 42 }, { text: "ARTIKEL-NR.", x: 76 }]),
      line(193, [{ text: "ARTIKELBEZEICHNUNG", x: 76 }, { text: "IN EUR", x: 120 }]),
      line(199, [{ text: "_______________________________", x: 265 }]),
      line(215, [{ text: "00010", x: 42 }, { text: "581558", x: 76 }]),
      line(230, [{ text: "Produkt", x: 76 }]),
      line(300, [{ text: "Brutto-Warenbetrag: 847,36", x: 230 }]),
    ];
    const end = findTableEndIndex({ lines, height: 842 }, 2, [], {});
    expect(end).toBe(5);
  });

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

describe("findTableRegionOrContinuation", () => {
  it("finds continuation page region past repeating letterhead", () => {
    const lines: PdfLine[] = [
      line(100, [{ text: "Gedruckt am 21.05.2026", x: 280, fontSize: 8 }]),
      line(100, [{ text: "Seite 3 / 4", x: 490, fontSize: 8 }]),
      line(120, [{ text: "ANGEBOT", x: 280, fontSize: 10 }]),
      line(200, [
        { text: "POS.", x: 42 },
        { text: "ARTIKEL-NR.", x: 76 },
        { text: "MENGE", x: 274 },
      ]),
      line(220, [{ text: "00010", x: 42 }, { text: "9802917", x: 76 }]),
      line(240, [{ text: "Schraube", x: 76 }]),
    ];
    const region = findTableRegionOrContinuation({ lines, height: 842 });
    expect(region).not.toBeNull();
    expect(region!.dataStartIndex).toBe(4);
    expect(region!.dataEndIndex).toBeGreaterThan(4);
  });
});

describe("findTableRegion", () => {
  it("detects Laier-style header split across lines at the same Y", () => {
    const y = 262;
    const lines: PdfLine[] = [
      line(y, [{ text: "Artikel", x: 42 }]),
      line(y, [{ text: "Menge", x: 321 }]),
      line(y, [{ text: "Einheit", x: 353 }]),
      line(y, [{ text: "VK-Preis", x: 409 }]),
      line(y, [{ text: "Betrag", x: 532 }]),
      line(286, [{ text: "55510010 (Alternativposition)", x: 42 }]),
      line(298, [
        { text: "Sockelschienen", x: 42 },
        { text: "2,500", x: 327 },
        { text: "m", x: 353 },
        { text: "428,40", x: 416 },
        { text: "(10,28)", x: 532 },
      ]),
    ];
    const region = findTableRegion({ lines, height: 842 });
    expect(region).not.toBeNull();
    expect(region?.columnMap.article).toBeDefined();
    expect(region?.dataStartIndex).toBeGreaterThan(4);
  });

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

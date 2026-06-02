import { describe, expect, it } from "vitest";
import type { PdfLine, PdfPageStructured } from "../../pdf/types";
import {
  columnRoleForLine,
  extractNoritStructured,
  noritLineToCells,
} from "./norit-structured";
import { NORIT_TEMPLATE } from "../pipeline/templates";
import { calibrateColumnWindows } from "../pipeline/columns";

function frag(text: string, x: number, y: number): PdfLine {
  return { y, text, words: [{ text, x, y, fontSize: 10 }] };
}

const WINDOWS = NORIT_TEMPLATE.defaultWindows;

describe("noritLineToCells", () => {
  it("assigns whole fragment to Menge column by x", () => {
    expect(noritLineToCells(frag("900X600X25 MM", 263, 339), WINDOWS).quantity).toBe(
      "900X600X25 MM",
    );
    expect(noritLineToCells(frag("50 St", 263, 305), WINDOWS).quantity).toBe("50 St");
    expect(noritLineToCells(frag("Abmessung:", 97, 339), WINDOWS).description).toBe("Abmessung:");
  });

  it("maps Pos and Nettowert columns", () => {
    expect(columnRoleForLine(frag("130", 68, 305), WINDOWS)).toBe("position");
    expect(noritLineToCells(frag("753,30 EUR", 484, 305), WINDOWS).lineTotal).toBe("753,30 EUR");
  });
});

describe("extractNoritStructured", () => {
  function pageWithItemLines(extra: PdfLine[]): PdfPageStructured {
    const header: PdfLine[] = [
      frag("Pos", 68, 251),
      frag("Artikel", 97, 251),
      frag("Menge", 263, 251),
      frag("Einzelpreis", 376, 251),
      frag("Nettowert", 492, 251),
    ];
    return {
      index: 0,
      width: 595,
      height: 842,
      rawText: "",
      lines: [...header, ...extra],
    };
  }

  it("pairs Artikel labels with Menge values on the same row band", () => {
    const page = pageWithItemLines([
      frag("50 St", 263, 300),
      frag("130", 68, 305),
      frag("TE 25 Therm GF-E 150-15", 97, 305),
      frag("50 St", 263, 305),
      frag("27,90 EUR /m²", 376, 305),
      frag("753,30 EUR", 484, 305),
      frag("Heiz-Element aus Gipsfaser", 97, 316),
      frag("27,000 m²", 263, 317),
      frag("VPE: 50 Stück/Palette", 97, 328),
      frag("Abmessung:", 97, 339),
      frag("900X600X25 MM", 263, 339),
      frag("Artikelnummer:", 97, 351),
      frag("00114339", 263, 351),
      frag("Zolltarifnr.:", 97, 363),
      frag("68099000", 263, 363),
    ]);

    const items = extractNoritStructured({ pages: [page], sourceFileName: "test.pdf" });
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.position).toBe("130");
    expect(item.line_total).toBe(753.3);
    expect(item.quantity).toBe(27);
    expect(item.unit).toBe("m²");
    expect(item.unit_price).toBe(27.9);
    expect(item.article_number).toBe("00114339");
    expect(item.description).toContain("TE 25 Therm GF-E 150-15");
    expect(item.description).toContain("Abmessung:");
    expect(item.description).toContain("900X600X25 MM");
    expect(item.description).toContain("Artikelnummer:");
    expect(item.description).toContain("68099000");
  });
});

describe("calibrateColumnWindows for Norit headers", () => {
  it("centers Menge column around x≈263", () => {
    const page: PdfPageStructured = {
      index: 0,
      width: 595,
      height: 842,
      rawText: "",
      lines: [
        frag("Pos", 68, 251),
        frag("Artikel", 97, 251),
        frag("Menge", 263, 251),
        frag("Einzelpreis", 376, 251),
        frag("Nettowert", 492, 251),
      ],
    };
    const windows = calibrateColumnWindows(
      [page],
      NORIT_TEMPLATE.headerHints,
      NORIT_TEMPLATE.defaultWindows,
    );
    const qty = windows.find((w) => w.role === "quantity");
    expect(qty).toBeDefined();
    expect(noritLineToCells(frag("27,000 m²", 263, 300), windows).quantity).toBe("27,000 m²");
  });
});

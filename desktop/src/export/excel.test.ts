import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import type { ExtractionResult } from "../extractor/models";
import { buildExcelBuffer, MATERIALLISTE_HEADERS } from "./excel";
import { EXCEL_EURO_NUMFMT, EXCEL_QUANTITY_INTEGER_NUMFMT, EXCEL_QUANTITY_NUMFMT } from "./format-money";

describe("buildExcelBuffer", () => {
  it("returns a non-trivial xlsx buffer", async () => {
    const result: ExtractionResult = {
      layout_id: "test",
      source_pdf: "test.pdf",
      items: [
        {
          position: "1",
          article_number: "A-1",
          artikel_prefix: null,
          description: "Testartikel",
          quantity: 2,
          unit: "Stk",
          unit_price: 10,
          line_total: 20,
        },
      ],
    };

    const buf = await buildExcelBuffer(result, { aufschlag: 0.2 });
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it("matches Materialliste template column order and formulas", async () => {
    const result: ExtractionResult = {
      layout_id: "test",
      source_pdf: "test.pdf",
      items: [
        {
          position: "1",
          article_number: "A-1",
          artikel_prefix: null,
          description: "Test",
          quantity: 2,
          unit: "Stk",
          unit_price: 10,
          line_total: 20,
        },
      ],
    };

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await buildExcelBuffer(result, { aufschlag: 0.2 })));
    const sheet = wb.worksheets[0]!;

    const headerRowValues = sheet.getRow(1).values;
    expect(
      Array.isArray(headerRowValues) ? headerRowValues.slice(1) : [],
    ).toEqual([...MATERIALLISTE_HEADERS]);

    const row2 = sheet.getRow(2);
    expect(row2.getCell(1).value).toBe("A-1\nTest");
    // New layout: F = VK-Rabatt, G = intentionally empty spacer, H = Einzelpreis PDF, I = Aufschlag
    expect(row2.getCell(6).value).toBeNull();
    expect(row2.getCell(7).value).toBeNull();
    expect(row2.getCell(8).value).toBe(10);
    expect(row2.getCell(9).value).toBe(0.2);
    expect(row2.getCell(4).formula).toBe("H2*(1+I2)*(1-F2/100)");
    expect(row2.getCell(5).formula).toBe("D2*B2");

    expect(sheet.getRow(1).getCell(1).font?.bold).toBe(true);

    expect(sheet.getColumn(2).numFmt).toBe(EXCEL_QUANTITY_INTEGER_NUMFMT);
    expect(sheet.getColumn(4).numFmt).toBe(EXCEL_EURO_NUMFMT);
    expect(sheet.getColumn(5).numFmt).toBe(EXCEL_EURO_NUMFMT);
    expect(sheet.getColumn(8).numFmt).toBe(EXCEL_EURO_NUMFMT);

    expect(sheet.getRow(5).getCell(4).value).toBe("Gesamt Netto");
    expect(sheet.getRow(5).getCell(5).formula).toBe("ROUND(SUM(E2:E2),2)");
    expect(sheet.getRow(6).getCell(4).value).toBe("Mwst. 19%");
    expect(sheet.getRow(6).getCell(5).formula).toBe("ROUND(E5*0.19,2)");
    expect(sheet.getRow(7).getCell(4).value).toBe("Gesamtbetrag");
    expect(sheet.getRow(7).getCell(5).formula).toBe("ROUND(E5+E6,2)");

    expect(sheet.getRow(2).getCell(2).numFmt).toBe(EXCEL_QUANTITY_INTEGER_NUMFMT);
    expect(sheet.getRow(2).getCell(4).numFmt).toBe(EXCEL_EURO_NUMFMT);
    expect(sheet.getRow(2).getCell(5).numFmt).toBe(EXCEL_EURO_NUMFMT);
    expect(sheet.getRow(2).getCell(8).numFmt).toBe(EXCEL_EURO_NUMFMT);
  });

  it("uses multiplier formula when price_per is below 1", async () => {
    const result: ExtractionResult = {
      layout_id: "Kölnsperger",
      source_pdf: "test.pdf",
      items: [
        {
          position: "9",
          article_number: "D9203",
          artikel_prefix: null,
          description: "Fracht",
          quantity: 3167,
          unit: "‰ST",
          unit_price: 180,
          line_total: 570.06,
          price_per: 0.001,
        },
      ],
    };

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await buildExcelBuffer(result, { aufschlag: 0 })));
    const row2 = wb.worksheets[0]!.getRow(2);
    expect(row2.getCell(5).formula).toBe("D2*B2*0.001");
    expect(row2.getCell(5).result).toBeCloseTo(570.06, 2);
  });

  it("divides Gesamt by price_per when set", async () => {
    const result: ExtractionResult = {
      layout_id: "Rudolf Laier GmbH",
      source_pdf: "test.pdf",
      items: [
        {
          position: "1",
          article_number: "55610915",
          artikel_prefix: null,
          description: "Test\n(Preis per 100)",
          quantity: 1100,
          unit: "Stück",
          unit_price: 40.5,
          line_total: 427.68,
          vk_discount_percent: 4,
          price_per: 100,
        },
      ],
    };

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await buildExcelBuffer(result, { aufschlag: 0 })));
    const row2 = wb.worksheets[0]!.getRow(2);
    expect(row2.getCell(5).formula).toBe("D2*B2/100");
    // 40.5 discounted by 4% => 38.88; 1100 * 38.88 / 100 = 427.68
    expect(row2.getCell(5).result).toBeCloseTo(427.68, 2);
  });

  it("uses integer quantity format for whole numbers (no trailing comma in de-DE Excel)", async () => {
    const result: ExtractionResult = {
      layout_id: "test",
      source_pdf: "test.pdf",
      items: [
        {
          position: "1",
          article_number: "A-1",
          artikel_prefix: null,
          description: "Ganzzahl",
          quantity: 43,
          unit: "m²",
          unit_price: 10,
          line_total: 430,
        },
        {
          position: "2",
          article_number: "A-2",
          artikel_prefix: null,
          description: "Dezimal",
          quantity: 2.6,
          unit: "Stk",
          unit_price: 5,
          line_total: 13,
        },
      ],
    };

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await buildExcelBuffer(result, { aufschlag: 0 })));
    const sheet = wb.worksheets[0]!;
    expect(sheet.getRow(2).getCell(2).numFmt).toBe(EXCEL_QUANTITY_INTEGER_NUMFMT);
    expect(sheet.getRow(4).getCell(2).numFmt).toBe(EXCEL_QUANTITY_NUMFMT);
  });
});

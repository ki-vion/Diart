import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import type { ExtractionResult } from "../extractor/models";
import { buildExcelBuffer, MATERIALLISTE_HEADERS } from "./excel";

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

    expect(sheet.getRow(1).values?.slice(1)).toEqual([...MATERIALLISTE_HEADERS]);

    const row2 = sheet.getRow(2);
    expect(row2.getCell(1).value).toBe("1");
    expect(row2.getCell(7).value).toBeNull();
    expect(row2.getCell(8).value).toBe(10);
    expect(row2.getCell(9).value).toBe(0.2);
    expect(row2.getCell(5).formula).toBe("H2*(1+I2)");
    expect(row2.getCell(6).formula).toBe("E2*C2");

    expect(sheet.getRow(1).getCell(1).font?.bold).toBe(true);

    expect(sheet.getRow(5).getCell(5).value).toBe("Gesamt Netto");
    expect(sheet.getRow(5).getCell(6).formula).toBe("SUM(F2:F2)");
    expect(sheet.getRow(6).getCell(5).value).toBe("Mwst. 19%");
    expect(sheet.getRow(6).getCell(6).formula).toBe("F5*0.19");
    expect(sheet.getRow(7).getCell(5).value).toBe("Gesamtbetrag");
    expect(sheet.getRow(7).getCell(6).formula).toBe("F5+F6");
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
          price_per: 100,
        },
      ],
    };

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await buildExcelBuffer(result, { aufschlag: 0 })));
    const row2 = wb.worksheets[0]!.getRow(2);
    expect(row2.getCell(6).formula).toBe("E2*C2/100");
    expect(row2.getCell(6).result).toBeCloseTo(445.5, 2);
  });
});

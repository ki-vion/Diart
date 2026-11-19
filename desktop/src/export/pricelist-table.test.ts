import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import type { ExtractionResult, LineItem } from "../extractor/models";
import { buildExcelBuffer } from "./excel";
import { buildPricelistTable, isPricelistResult } from "./pricelist-table";

function item(overrides: Partial<LineItem>): LineItem {
  return {
    position: null,
    article_number: null,
    artikel_prefix: null,
    description: "",
    quantity: null,
    unit: null,
    unit_price: null,
    line_total: null,
    ...overrides,
  };
}

const ITEMS: LineItem[] = [
  item({
    article_number: "110554",
    description: "NORIT-TE 15",
    unit: "m²",
    unit_price: 15.5,
    section: "NORIT-Trockenestrich",
    tier_prices: [
      { label: "ab 5 t", price: 15.5 },
      { label: "ab 12 t", price: 15.05 },
    ],
  }),
  item({
    article_number: "600525",
    description: "NORIT-Trockenschüttung *1",
    unit: "Sack",
    unit_price: 10.16,
    section: "NORIT-Schüttung und Zubehör",
    tier_prices: [{ label: "Nettopreis frei Haus", price: 10.16 }],
  }),
];

describe("buildPricelistTable", () => {
  it("renders sections with their own header row and price columns", () => {
    const table = buildPricelistTable(ITEMS);
    expect(table.columnCount).toBe(5);
    expect(table.priceColumns).toEqual([2, 3]);
    expect(table.rows).toEqual([
      { kind: "section", title: "NORIT-Trockenestrich" },
      {
        kind: "header",
        cells: ["Teilenr.", "Teilebezeichnung", "ab 5 t (€)", "ab 12 t (€)", "Einheit"],
      },
      { kind: "item", cells: ["110554", "NORIT-TE 15", 15.5, 15.05, "m²"] },
      { kind: "spacer" },
      { kind: "section", title: "NORIT-Schüttung und Zubehör" },
      {
        kind: "header",
        cells: ["Teilenr.", "Teilebezeichnung", "Nettopreis frei Haus (€)", "", "Einheit"],
      },
      { kind: "item", cells: ["600525", "NORIT-Trockenschüttung *1", 10.16, null, "Sack"] },
    ]);
  });

  it("only treats results as price list when every item has tier prices", () => {
    expect(isPricelistResult({ items: ITEMS })).toBe(true);
    expect(isPricelistResult({ items: [item({ unit_price: 1 })] })).toBe(false);
    expect(isPricelistResult({ items: [] })).toBe(false);
  });
});

describe("buildExcelBuffer (price list)", () => {
  it("writes a Konditionen sheet without Aufschlag or totals", async () => {
    const result: ExtractionResult = {
      layout_id: "Norit Konditionen",
      source_pdf: "k.pdf",
      items: ITEMS,
    };
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await buildExcelBuffer(result, { aufschlag: 0.2 })));
    const sheet = wb.worksheets[0]!;

    expect(sheet.name).toBe("Konditionen");
    expect(sheet.getRow(1).getCell(1).value).toBe("NORIT-Trockenestrich");
    expect(sheet.getRow(3).values).toEqual([
      undefined,
      "110554",
      "NORIT-TE 15",
      15.5,
      15.05,
      "m²",
    ]);
    const allText = JSON.stringify(sheet.getSheetValues());
    expect(allText).not.toContain("Aufschlag");
    expect(allText).not.toContain("Gesamt");
  });
});

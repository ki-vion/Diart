import type ExcelJS from "exceljs";
import type { ExtractionResult } from "../extractor/models";
import { EXCEL_EURO_NUMFMT } from "./format-money";
import { buildPricelistTable } from "./pricelist-table";

const COLUMN_WIDTHS = { article: 12, description: 44, price: 18, unit: 10 } as const;

function boldRow(row: ExcelJS.Row): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { ...cell.font, bold: true };
  });
}

/** Writes the price list 1:1 as in the PDF (sections, header rows, kept price columns). */
export function writePricelistSheet(workbook: ExcelJS.Workbook, result: ExtractionResult): void {
  const sheet = workbook.addWorksheet("Konditionen");
  const table = buildPricelistTable(result.items);

  sheet.getColumn(1).width = COLUMN_WIDTHS.article;
  sheet.getColumn(2).width = COLUMN_WIDTHS.description;
  for (const idx of table.priceColumns) {
    const col = sheet.getColumn(idx + 1);
    col.width = COLUMN_WIDTHS.price;
    col.numFmt = EXCEL_EURO_NUMFMT;
  }
  sheet.getColumn(table.columnCount).width = COLUMN_WIDTHS.unit;

  for (const row of table.rows) {
    switch (row.kind) {
      case "spacer":
        sheet.addRow([]);
        break;
      case "section": {
        const added = sheet.addRow([row.title]);
        added.getCell(1).font = { bold: true, size: 12 };
        break;
      }
      case "header":
        boldRow(sheet.addRow(row.cells));
        break;
      case "item": {
        const added = sheet.addRow(row.cells);
        for (const idx of table.priceColumns) {
          added.getCell(idx + 1).numFmt = EXCEL_EURO_NUMFMT;
        }
        break;
      }
    }
  }
}

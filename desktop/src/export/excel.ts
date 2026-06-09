import ExcelJS from "exceljs";
import type { ExtractionResult } from "../extractor/models";
import { formatArtikelCell, formatEinheitCell } from "./format-artikel";
import { EXCEL_EURO_NUMFMT, EXCEL_QUANTITY_NUMFMT } from "./format-money";

export type BuildExcelOptions = {
  /**
   * Factor value. Example: 0.2 means 20%.
   */
  aufschlag: number;
};

/** Materialliste export columns (A–H, F empty). */
export const MATERIALLISTE_HEADERS = [
  "Artikel",
  "Menge",
  "Einheit",
  "Einzelpreis (€)",
  "Gesamt (€)",
  "",
  "Einzelpreis PDF (€)",
  "Aufschlag",
] as const;

const MWST_RATE = 0.19;
const FOOTER_GAP_ROWS = 2;

function boldRow(row: ExcelJS.Row): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { ...cell.font, bold: true };
  });
}

function applyDataRowFormats(row: ExcelJS.Row): void {
  row.getCell(2).numFmt = EXCEL_QUANTITY_NUMFMT;
  row.getCell(4).numFmt = EXCEL_EURO_NUMFMT;
  row.getCell(5).numFmt = EXCEL_EURO_NUMFMT;
  row.getCell(7).numFmt = EXCEL_EURO_NUMFMT;
}

function applyEuroFooterCell(cell: ExcelJS.Cell): void {
  cell.numFmt = EXCEL_EURO_NUMFMT;
}

function addSummaryFooters(sheet: ExcelJS.Worksheet, firstDataRow: number, lastDataRow: number): void {
  for (let i = 0; i < FOOTER_GAP_ROWS; i++) {
    sheet.addRow([]);
  }

  const sumRange = `E${firstDataRow}:E${lastDataRow}`;

  const nettoRowNum = sheet.rowCount + 1;
  const nettoRow = sheet.addRow([
    null,
    null,
    null,
    "Gesamt Netto",
    { formula: `ROUND(SUM(${sumRange}),2)` },
    null,
    null,
    null,
  ]);
  applyEuroFooterCell(nettoRow.getCell(5));

  const mwstRowNum = sheet.rowCount + 1;
  const mwstRow = sheet.addRow([
    null,
    null,
    null,
    "Mwst. 19%",
    { formula: `ROUND(E${nettoRowNum}*${MWST_RATE},2)` },
    null,
    null,
    null,
  ]);
  applyEuroFooterCell(mwstRow.getCell(5));

  const bruttoRow = sheet.addRow([
    null,
    null,
    null,
    "Gesamtbetrag",
    { formula: `ROUND(E${nettoRowNum}+E${mwstRowNum},2)` },
    null,
    null,
    null,
  ]);
  applyEuroFooterCell(bruttoRow.getCell(5));
}

export async function buildExcelBuffer(
  result: ExtractionResult,
  opts: BuildExcelOptions,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Materialliste");

  sheet.addRow([...MATERIALLISTE_HEADERS]);
  boldRow(sheet.getRow(1));

  const artikelCol = sheet.getColumn(1);
  artikelCol.width = 48;
  artikelCol.alignment = { wrapText: true, vertical: "top" };

  sheet.getColumn(2).numFmt = EXCEL_QUANTITY_NUMFMT;
  sheet.getColumn(4).numFmt = EXCEL_EURO_NUMFMT;
  sheet.getColumn(5).numFmt = EXCEL_EURO_NUMFMT;
  sheet.getColumn(7).numFmt = EXCEL_EURO_NUMFMT;

  const aufschlagFactor = opts.aufschlag ?? 0;
  const firstDataRow = 2;

  for (let i = 0; i < result.items.length; i++) {
    const item = result.items[i]!;
    const rowIndex = sheet.rowCount + 1;

    const menge = item.quantity ?? null;
    const einzelpreisPdf = item.unit_price ?? null;

    const vk =
      menge !== null && einzelpreisPdf !== null ? einzelpreisPdf * (1 + aufschlagFactor) : null;
    const pricePer = item.price_per ?? 1;
    const gesamt =
      menge !== null && vk !== null ? (menge * vk) / pricePer : null;
    const gesamtFormula =
      pricePer > 1
        ? `D${rowIndex}*B${rowIndex}/${pricePer}`
        : `D${rowIndex}*B${rowIndex}`;

    const row = sheet.addRow([
      formatArtikelCell(item, { layoutId: result.layout_id }),
      menge,
      formatEinheitCell(item.unit, item.description),
      { formula: `G${rowIndex}*(1+H${rowIndex})`, result: vk ?? undefined },
      { formula: gesamtFormula, result: gesamt ?? undefined },
      null,
      einzelpreisPdf,
      aufschlagFactor,
    ]);
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
    applyDataRowFormats(row);

    if (i < result.items.length - 1) {
      sheet.addRow([]);
    }
  }

  const lastDataRow = sheet.rowCount;
  if (lastDataRow >= firstDataRow) {
    addSummaryFooters(sheet, firstDataRow, lastDataRow);
  }

  const raw = await workbook.xlsx.writeBuffer();
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (typeof raw === "object" && raw && "byteLength" in raw) return raw as Uint8Array;
  throw new Error("EXCEL_WRITEBUFFER_UNEXPECTED_TYPE");
}

import ExcelJS from "exceljs";
import type { ExtractionResult } from "../extractor/models";
import { formatArtikelCell, formatEinheitCell } from "./format-artikel";

export type BuildExcelOptions = {
  /**
   * Factor value. Example: 0.2 means 20%.
   */
  aufschlag: number;
};

/** Matches Vorlagen/Materialliste mit VK Preis.xlsx (A–I, G empty). */
export const MATERIALLISTE_HEADERS = [
  "Position",
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

function addSummaryFooters(sheet: ExcelJS.Worksheet, firstDataRow: number, lastDataRow: number): void {
  for (let i = 0; i < FOOTER_GAP_ROWS; i++) {
    sheet.addRow([]);
  }

  const sumRange = `F${firstDataRow}:F${lastDataRow}`;

  const nettoRowNum = sheet.rowCount + 1;
  sheet.addRow([
    null,
    null,
    null,
    null,
    "Gesamt Netto",
    { formula: `SUM(${sumRange})` },
    null,
    null,
    null,
  ]);

  const mwstRowNum = sheet.rowCount + 1;
  sheet.addRow([
    null,
    null,
    null,
    null,
    "Mwst. 19%",
    { formula: `F${nettoRowNum}*${MWST_RATE}` },
    null,
    null,
    null,
  ]);

  sheet.addRow([
    null,
    null,
    null,
    null,
    "Gesamtbetrag",
    { formula: `F${nettoRowNum}+F${mwstRowNum}` },
    null,
    null,
    null,
  ]);
}

export async function buildExcelBuffer(
  result: ExtractionResult,
  opts: BuildExcelOptions,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Materialliste");

  sheet.addRow([...MATERIALLISTE_HEADERS]);
  boldRow(sheet.getRow(1));

  const artikelCol = sheet.getColumn(2);
  artikelCol.width = 48;
  artikelCol.alignment = { wrapText: true, vertical: "top" };

  const aufschlagFactor = opts.aufschlag ?? 0;
  const firstDataRow = 2;

  for (const item of result.items) {
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
        ? `E${rowIndex}*C${rowIndex}/${pricePer}`
        : `E${rowIndex}*C${rowIndex}`;

    const row = sheet.addRow([
      item.position ?? "",
      formatArtikelCell(item, { layoutId: result.layout_id }),
      menge,
      formatEinheitCell(item.unit, item.description),
      { formula: `H${rowIndex}*(1+I${rowIndex})`, result: vk ?? undefined },
      { formula: gesamtFormula, result: gesamt ?? undefined },
      null,
      einzelpreisPdf,
      aufschlagFactor,
    ]);
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
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

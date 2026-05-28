import ExcelJS from "exceljs";
import type { ExtractionResult } from "../extractor/models";

export type BuildExcelOptions = {
  /**
   * Factor value. Example: 0.2 means 20%.
   */
  aufschlag: number;
};

const HEADERS = [
  "Pos.",
  "Artikel",
  "Menge",
  "Einheit",
  "Einzelpreis PDF (€)",
  "Aufschlag",
  "Einzelpreis (€)",
  "Gesamt (€)",
] as const;

export async function buildExcelBuffer(
  result: ExtractionResult,
  opts: BuildExcelOptions,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Materialliste");

  sheet.addRow([...HEADERS]);

  const aufschlagFactor = opts.aufschlag ?? 0;

  for (const item of result.items) {
    const rowIndex = sheet.rowCount + 1; // next row number (1-based)

    const menge = item.quantity ?? null;
    const einzelpreisPdf = item.unit_price ?? null;

    const vk =
      menge !== null && einzelpreisPdf !== null ? einzelpreisPdf * (1 + aufschlagFactor) : null;
    const gesamt = menge !== null && vk !== null ? menge * vk : null;

    sheet.addRow([
      item.position ?? "",
      item.article_number ?? item.description,
      menge,
      item.unit ?? "",
      einzelpreisPdf,
      aufschlagFactor,
      { formula: `E${rowIndex}*(1+F${rowIndex})`, result: vk ?? undefined },
      { formula: `C${rowIndex}*G${rowIndex}`, result: gesamt ?? undefined },
    ]);
  }

  const raw = await workbook.xlsx.writeBuffer();
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  // Node can return a Buffer, which is a Uint8Array
  if (typeof raw === "object" && raw && "byteLength" in raw) return raw as Uint8Array;
  throw new Error("EXCEL_WRITEBUFFER_UNEXPECTED_TYPE");
}


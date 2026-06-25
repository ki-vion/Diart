import type { ExtractionResult } from "../models";
import type { PdfStructured } from "../../pdf/types";
import { extractMahlerItems } from "../table/mahler-extract";

export function extractMahler(
  structured: PdfStructured,
  source_pdf: string,
): ExtractionResult {
  const { items } = extractMahlerItems(structured);
  return {
    layout_id: "Bauwaren Mahler",
    source_pdf,
    items,
  };
}

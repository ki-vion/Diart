import type { ExtractionResult } from "../models";
import type { PdfStructured } from "../../pdf/types";
import { extractEconFloorItems } from "../table/econ-floor-extract";

export function extractEconFloor(
  structured: PdfStructured,
  source_pdf: string,
): ExtractionResult {
  const { items } = extractEconFloorItems(structured);
  return {
    layout_id: "econ floor",
    source_pdf,
    items,
  };
}

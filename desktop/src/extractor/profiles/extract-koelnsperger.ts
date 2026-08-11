import type { ExtractionResult } from "../models";
import type { PdfStructured } from "../../pdf/types";
import { extractKoelnspergerItems } from "../table/koelnsperger-extract";

export function extractKoelnsperger(
  structured: PdfStructured,
  source_pdf: string,
): ExtractionResult {
  const { items } = extractKoelnspergerItems(structured);
  return {
    layout_id: "Kölnsperger",
    source_pdf,
    items,
  };
}

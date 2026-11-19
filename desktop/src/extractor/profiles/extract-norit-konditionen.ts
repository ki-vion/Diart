import type { ExtractionResult } from "../models";
import type { PdfStructured } from "../../pdf/types";
import { assignSequentialPositions } from "../assign-positions";
import { extractNoritKonditionenItems } from "../table/norit-konditionen-extract";

export function extractNoritKonditionen(
  structured: PdfStructured,
  source_pdf: string,
): ExtractionResult {
  return {
    layout_id: "Norit Konditionen",
    source_pdf,
    items: assignSequentialPositions(extractNoritKonditionenItems(structured)),
  };
}

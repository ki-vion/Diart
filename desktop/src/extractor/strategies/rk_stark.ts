import type { ExtractionResult } from "../models";
import type { PdfStructured } from "../../pdf/types";
import { extractAnchoredItems } from "../table/anchor-extract";

/** RK/STARK extraction via shared anchor-block pipeline. */
export function extractFromStructured(
  structured: PdfStructured,
  source_pdf: string,
): ExtractionResult {
  return {
    layout_id: "rk_stark",
    source_pdf,
    items: extractAnchoredItems(structured, "rk_stark"),
  };
}

/** @deprecated Prefer extractFromStructured — flat lines without geometry. */
export function extractFromLines(lines: string[], source_pdf: string): ExtractionResult {
  const structured: PdfStructured = {
    pages: [
      {
        index: 0,
        width: 595,
        height: 842,
        rawText: lines.join("\n"),
        lines: lines.map((text, i) => ({
          y: i * 12,
          text,
          words: [{ text, x: 42, y: i * 12, fontSize: 10 }],
        })),
      },
    ],
  };
  return extractFromStructured(structured, source_pdf);
}

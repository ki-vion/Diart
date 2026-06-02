import type { ExtractionResult } from "../models";
import type { PdfStructured } from "../../pdf/types";
import { extractWithTemplate } from "../pipeline/extract";
import { RK_STARK_TEMPLATE } from "../pipeline/templates";
import { extractAnchoredItems } from "../table/anchor-extract";
import { columnContextFromTemplate } from "../table/column-block";
import { extractFromStructured as extractRkStructured } from "../strategies/rk_stark";

export { parseRkBlock } from "./extract-rk-legacy";

export function extractRkStark(
  structured: PdfStructured,
  source_pdf: string,
): ExtractionResult {
  const columnBlock = columnContextFromTemplate(RK_STARK_TEMPLATE, structured.pages);
  const fromAnchors = extractAnchoredItems(structured, {
    layout_id: "RAAB Karcher",
    columnBlock,
  });
  if (fromAnchors.length > 0) {
    return { layout_id: "RAAB Karcher", source_pdf, items: fromAnchors };
  }

  const fromPipeline = extractWithTemplate(structured, RK_STARK_TEMPLATE);
  if (fromPipeline.length > 0) {
    return { layout_id: "RAAB Karcher", source_pdf, items: fromPipeline };
  }

  return extractRkStructured(structured, source_pdf);
}

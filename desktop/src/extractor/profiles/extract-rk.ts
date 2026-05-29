import type { ExtractionResult } from "../models";
import type { PdfStructured } from "../../pdf/types";
import { extractWithTemplate } from "../pipeline/extract";
import { RK_STARK_TEMPLATE } from "../pipeline/templates";
import { extractAnchoredItems } from "../table/anchor-extract";
import { extractFromStructured as extractRkStructured } from "../strategies/rk_stark";

export { parseRkBlock } from "./extract-rk-legacy";

export function extractRkStark(
  structured: PdfStructured,
  source_pdf: string,
): ExtractionResult {
  const fromPipeline = extractWithTemplate(structured, RK_STARK_TEMPLATE);
  if (fromPipeline.length > 0) {
    return { layout_id: "rk_stark", source_pdf, items: fromPipeline };
  }

  const fromAnchors = extractAnchoredItems(structured, "rk_stark");
  if (fromAnchors.length > 0) {
    return { layout_id: "rk_stark", source_pdf, items: fromAnchors };
  }

  return extractRkStructured(structured, source_pdf);
}

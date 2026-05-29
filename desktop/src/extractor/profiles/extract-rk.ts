import type { ExtractionResult } from "../models";
import type { PdfStructured } from "../../pdf/types";
import { extractWithTemplate } from "../pipeline/extract";
import { RK_STARK_TEMPLATE } from "../pipeline/templates";
import { extractFromLines as extractRkFromAsText } from "../strategies/rk_stark";
import { allAsTextLines } from "./lines";

export { parseRkBlock } from "./extract-rk-legacy";

export function extractRkStark(
  structured: PdfStructured,
  source_pdf: string,
): ExtractionResult {
  const fromPipeline = extractWithTemplate(structured, RK_STARK_TEMPLATE);
  if (fromPipeline.length > 0) {
    return { layout_id: "rk_stark", source_pdf, items: fromPipeline };
  }

  return extractRkFromAsText(allAsTextLines(structured), source_pdf);
}

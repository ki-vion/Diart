import type { PdfText } from "../pdf/types";
import type { ExtractionResult } from "./models";
import { detectStrategy } from "./detector";

export function runExtraction(pdf: PdfText): ExtractionResult {
  const page0 = pdf.pages.find((p) => p.index === 0) ?? pdf.pages[0];
  const page0Text = (page0?.lines ?? []).join("\n");

  const strategy = detectStrategy(page0Text);
  const source_pdf = pdf.sourceFileName ?? "unknown.pdf";
  return strategy.extract(pdf, source_pdf);
}


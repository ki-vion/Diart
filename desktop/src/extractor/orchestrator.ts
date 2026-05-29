import type { PdfStructured } from "../pdf/types";
import type { ExtractionResult } from "./models";
import { detectProfile, extractByProfile } from "./profiles";

export function runExtraction(structured: PdfStructured): ExtractionResult {
  const source_pdf = structured.sourceFileName ?? "unknown.pdf";
  const profile = detectProfile(structured);
  return extractByProfile(structured, profile, source_pdf);
}

export { detectProfile };

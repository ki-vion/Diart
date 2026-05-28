import type { ExtractionResult } from "../models";

export type Strategy = {
  layout_id: string;
  matchesPage0Text: (page0Text: string) => boolean;
  extract: (pdf: { pages: { lines: string[] }[] }, source_pdf: string) => ExtractionResult;
};


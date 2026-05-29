import type { ExtractionResult } from "../models";
import type { PdfStructured } from "../../pdf/types";
import { extractFromLines as extractKanFromLines } from "../strategies/kan_ifb";
import { extractFromLines as extractLaierFromLines } from "../strategies/laier_van";
import { extractTableItems } from "../table/extract-table";
import { detectProfile } from "./detect-profile";
import { extractNorit } from "./extract-norit";
import { extractRkStark } from "./extract-rk";
import { allAsTextLines } from "./lines";
import type { PdfProfile } from "./types";

export { detectProfile, type PdfProfile };

export function extractByProfile(
  structured: PdfStructured,
  profile: PdfProfile,
  source_pdf: string,
): ExtractionResult {
  switch (profile) {
    case "kan_ifb":
      return extractKanFromLines(allAsTextLines(structured), source_pdf);
    case "norit_rechnung":
      return extractNorit(structured, source_pdf);
    case "rk_stark":
      return extractRkStark(structured, source_pdf);
    case "laier_van":
      return extractLaierFromLines(allAsTextLines(structured), source_pdf);
    case "generic":
      return extractTableItems(structured, source_pdf);
  }
}

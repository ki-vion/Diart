import type { ExtractionResult } from "../models";
import type { PdfStructured } from "../../pdf/types";
import { extractAnchoredItems } from "../table/anchor-extract";
import { columnContextFromTemplate } from "../table/column-block";
import { LAIER_VAN_TEMPLATE } from "../pipeline/templates";
import { extractFromLines as extractKanFromLines } from "../strategies/kan_ifb";
import { extractFromLines as extractLaierFromLines } from "../strategies/laier_van";
import { extractTableItems } from "../table/extract-table";
import { allAsTextLines } from "./lines";
import { detectProfile } from "./detect-profile";
import { extractMahler } from "./extract-mahler";
import { extractEconFloor } from "./extract-econ-floor";
import { extractNorit } from "./extract-norit";
import { extractRkStark } from "./extract-rk";
import { assignSequentialPositions } from "../assign-positions";
import type { PdfProfile } from "./types";

export { detectProfile, type PdfProfile };

export function extractByProfile(
  structured: PdfStructured,
  profile: PdfProfile,
  source_pdf: string,
): ExtractionResult {
  switch (profile) {
    case "IFB GmbH": {
      const items = extractAnchoredItems(structured, "IFB GmbH");
      if (items.length > 0) {
        return { layout_id: "IFB GmbH", source_pdf, items };
      }
      return extractKanFromLines(allAsTextLines(structured), source_pdf);
    }
    case "Norit":
      return extractNorit(structured, source_pdf);
    case "RAAB Karcher":
      return extractRkStark(structured, source_pdf);
    case "Rudolf Laier GmbH": {
      const columnBlock = columnContextFromTemplate(LAIER_VAN_TEMPLATE, structured.pages);
      const items = extractAnchoredItems(structured, {
        layout_id: "Rudolf Laier GmbH",
        columnBlock,
      });
      if (items.length > 0) {
        return {
          layout_id: "Rudolf Laier GmbH",
          source_pdf,
          items: assignSequentialPositions(items),
        };
      }
      const fallback = extractLaierFromLines(allAsTextLines(structured), source_pdf);
      return {
        ...fallback,
        items: assignSequentialPositions(fallback.items),
      };
    }
    case "Bauwaren Mahler":
      return extractMahler(structured, source_pdf);
    case "econ floor":
      return extractEconFloor(structured, source_pdf);
    case "generic":
      return extractTableItems(structured, source_pdf);
  }
}

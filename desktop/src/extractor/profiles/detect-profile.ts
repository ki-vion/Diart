import type { PdfStructured } from "../../pdf/types";
import type { PdfProfile } from "./types";

/** Pick extraction profile from page-0 text (supplier fingerprints). */
export function detectProfile(structured: PdfStructured): PdfProfile {
  const page0 = structured.pages[0]?.rawText ?? "";

  if (
    (page0.includes("@ifb-daemmstoff.de") && page0.includes("KAN")) ||
    (/\bKAN\b/i.test(page0) && /\bANGEBOT\b/i.test(page0))
  ) {
    return "IFB GmbH";
  }
  if (
    page0.includes("@Lindner-Group.com") ||
    (page0.includes("Rechnungsnummer:") && /Einzelpreis/i.test(page0))
  ) {
    return "Norit";
  }
  if (page0.includes("STARK Deutschland") || page0.includes("Raab Karcher")) {
    return "RAAB Karcher";
  }
  if (page0.includes("Rudolf Laier GmbH") || page0.includes("@laier.biz")) {
    return "Rudolf Laier GmbH";
  }
  if (page0.includes("Bauwaren Mahler") || page0.includes("www.mahler.de")) {
    return "Bauwaren Mahler";
  }
  if (
    page0.includes("koelnsperger-gmbh.de") ||
    page0.includes("Kölnsperger Bedachungshandel")
  ) {
    return "Kölnsperger";
  }
  if (
    page0.includes("econfloorpolska.com") ||
    page0.includes("ECONFLOOR") ||
    (page0.includes("Commercial Offer") && /ECONFLOOR/i.test(page0))
  ) {
    return "econ floor";
  }

  return "generic";
}

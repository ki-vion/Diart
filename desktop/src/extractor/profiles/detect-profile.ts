import type { PdfStructured } from "../../pdf/types";
import type { PdfProfile } from "./types";

/** Pick extraction profile from page-0 text (supplier fingerprints). */
export function detectProfile(structured: PdfStructured): PdfProfile {
  const page0 = structured.pages[0]?.rawText ?? "";

  if (page0.includes("ANGEBOT") && page0.includes("KAN")) {
    return "kan_ifb";
  }
  if (page0.includes("Rechnungsnummer:") && page0.includes("Einzelpreis")) {
    return "norit_rechnung";
  }
  if (page0.includes("STARK Deutschland") || page0.includes("Raab Karcher")) {
    return "rk_stark";
  }
  if (page0.includes("VK-Preis") && (page0.includes("Rudolf Laier") || page0.includes("VAN0"))) {
    return "laier_van";
  }

  return "generic";
}

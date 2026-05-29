import { describe, expect, it } from "vitest";
import type { PdfStructured } from "../../pdf/types";
import { extractFromStructured } from "./rk_stark";

function pdfLine(y: number, text: string, x: number, fontSize: number) {
  return { y, text, words: [{ text, x, y, fontSize }] };
}

describe("rk_stark extractFromStructured footer", () => {
  it("does not append page footer to last position block", () => {
    const structured: PdfStructured = {
      pages: [
        {
          index: 1,
          width: 595,
          height: 842,
          rawText: "",
          lines: [
            pdfLine(621, "00040 1040847", 42, 9.96),
            pdfLine(622, "5", 76, 9.96),
            pdfLine(623, "SA", 76, 9.96),
            pdfLine(624, "4,00", 76, 9.96),
            pdfLine(625, "EUR/1 SA", 76, 9.96),
            pdfLine(633, "RAW Betonestrich fein", 76, 9.96),
            pdfLine(645, "Körn.4mm30kg/Sa", 76, 9.96),
            pdfLine(399, "______________________________________________________________________", 42, 9.96),
            pdfLine(415, "GewichtBrutto 400,054KG Nettowert: 2.859,50", 42, 9.96),
            pdfLine(463, "DerGesamtbetragenthältnichtskontierfähige", 42, 9.96),
            pdfLine(775, "RaabKarcher-eineMarkederSTARKDeutschlandGmbH", 222, 6),
            pdfLine(782, "Hafeninsel9·63067OffenbachamMain", 154, 6),
          ],
        },
      ],
    };

    const { items } = extractFromStructured(structured, "test.pdf");
    expect(items).toHaveLength(1);
    expect(items[0]?.position).toBe("00040");
    expect(items[0]?.description).toContain("RAW Betonestrich");
    expect(items[0]?.description).not.toMatch(/Raab Karcher|STARK Deutschland/i);
    expect(items[0]?.unit_price).toBeLessThan(100_000);
  });
});

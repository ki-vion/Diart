import { describe, expect, it } from "vitest";
import { extractTableItems } from "./extract-table";
import type { PdfStructured } from "../../pdf/types";

function line(
  y: number,
  parts: Array<{ text: string; x: number }>,
): { y: number; words: { text: string; x: number; y: number; fontSize: number }[]; text: string } {
  const words = parts.map((p) => ({ ...p, y, fontSize: 10 }));
  return { y, words, text: words.map((w) => w.text).join(" ") };
}

describe("extractTableItems", () => {
  it("extracts rows below a header line with column geometry", () => {
    const structured: PdfStructured = {
      sourceFileName: "test.pdf",
      pages: [
        {
          index: 0,
          width: 600,
          height: 800,
          rawText: "",
          lines: [
            line(100, [
              { text: "Pos", x: 40 },
              { text: "Bezeichnung", x: 120 },
              { text: "Menge", x: 300 },
              { text: "ME", x: 360 },
              { text: "Preis", x: 420 },
            ]),
            line(120, [
              { text: "001", x: 40 },
              { text: "Schraube", x: 120 },
              { text: "2,00", x: 300 },
              { text: "Stk", x: 360 },
              { text: "10,00", x: 420 },
            ]),
            line(140, [
              { text: "002", x: 40 },
              { text: "Dübel", x: 120 },
              { text: "5", x: 300 },
              { text: "Stk", x: 360 },
              { text: "1,50", x: 420 },
            ]),
          ],
        },
      ],
    };

    const result = extractTableItems(structured, "test.pdf");
    expect(result.layout_id).toBe("table_geometry");
    expect(result.items.length).toBeGreaterThanOrEqual(2);
    expect(result.items[0]?.position).toBe("001");
    expect(result.items[0]?.quantity).toBe(2);
    expect(result.items[0]?.unit_price).toBe(10);
  });
});

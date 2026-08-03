import { describe, expect, it } from "vitest";
import type { PdfLine, PdfStructured } from "../../pdf/types";
import { extractEconFloorItems } from "./econ-floor-extract";

function line(y: number, parts: Array<{ text: string; x: number }>): PdfLine {
  const words = parts.map((p) => ({ ...p, y, fontSize: 10 }));
  return { y, words, text: words.map((w) => w.text).join(" ") };
}

describe("extractEconFloorItems", () => {
  it("extracts synthetic FPF-style rows with split descriptions", () => {
    const yHeader = 331;
    const lines: PdfLine[] = [
      line(yHeader, [
        { text: "No.", x: 62 },
        { text: "Item/Service", x: 76 },
        { text: "Name", x: 129 },
        { text: "BOX", x: 246 },
        { text: "Quantity", x: 286 },
        { text: "UOM", x: 321 },
      ]),
      line(346, [
        { text: "1.257255", x: 68 },
        { text: "14", x: 247 },
        { text: "37,1", x: 303 },
        { text: "m2", x: 322 },
        { text: "14,65", x: 409 },
        { text: "0%", x: 477 },
        { text: "543,52", x: 536 },
      ]),
      line(358, [
        { text: "SPC", x: 76 },
        { text: "Rigid", x: 92 },
        { text: "Vinyl", x: 111 },
        { text: "Floor", x: 129 },
      ]),
      line(474, [
        { text: "6.", x: 67 },
        { text: "Transport", x: 76 },
        { text: "0", x: 247 },
        { text: "1", x: 314 },
        { text: "sz", x: 322 },
        { text: "250,00", x: 404 },
        { text: "0%", x: 477 },
        { text: "250,00", x: 535 },
      ]),
      line(513, [{ text: "Payment Form", x: 55 }]),
    ];

    const structured: PdfStructured = {
      sourceFileName: "fpf.pdf",
      pages: [
        {
          index: 0,
          width: 595,
          height: 842,
          lines,
          rawText: "Proforma Invoice\nECONFLOOR",
        },
      ],
    };

    const { items } = extractEconFloorItems(structured);
    expect(items.length).toBe(2);

    expect(items[0]?.position).toBe("1");
    expect(items[0]?.article_number).toBe("257255");
    expect(items[0]?.description).toContain("SPC");
    expect(items[0]?.quantity).toBe(37.1);
    expect(items[0]?.unit).toBe("m2");
    expect(items[0]?.unit_price).toBe(14.65);
    expect(items[0]?.line_total).toBe(543.52);

    expect(items[1]?.position).toBe("6");
    expect(items[1]?.description).toContain("Transport");
    expect(items[1]?.quantity).toBe(1);
    expect(items[1]?.line_total).toBe(250);
  });
});

import { describe, expect, it } from "vitest";
import type { PdfLine, PdfStructured } from "../../pdf/types";
import { extractEconFloorItems } from "./econ-floor-extract";
import {
  ECON_FLOOR_POSITION_RE,
  hasEconFloorRowSignal,
  looksLikeEconFloorArticle,
} from "./econ-floor-anchors";

function line(y: number, parts: Array<{ text: string; x: number }>): PdfLine {
  const words = parts.map((p) => ({ ...p, y, fontSize: 10 }));
  return { y, words, text: words.map((w) => w.text).join(" ") };
}

describe("econ floor anchors", () => {
  it("matches position and article codes", () => {
    expect(ECON_FLOOR_POSITION_RE.test("1")).toBe(true);
    expect(ECON_FLOOR_POSITION_RE.test("12")).toBe(true);
    expect(looksLikeEconFloorArticle("259255")).toBe(true);
    expect(looksLikeEconFloorArticle("SL2592/SL3285")).toBe(true);
    expect(looksLikeEconFloorArticle("3085")).toBe(true);
    expect(looksLikeEconFloorArticle("Transport")).toBe(false);
  });

  it("ignores stray digits without same-Y row signal", () => {
    const lines = [
      line(486, [{ text: "1", x: 80 }]),
      line(486, [{ text: "259255", x: 133 }]),
      line(493, [{ text: "2", x: 76 }]),
      line(494, [{ text: "SPC Rigid Vinyl Floor", x: 103 }]),
    ];
    expect(hasEconFloorRowSignal(lines, 0)).toBe(true);
    expect(hasEconFloorRowSignal(lines, 2)).toBe(false);
  });
});

describe("extractEconFloorItems", () => {
  it("extracts commercial offer rows including transport", () => {
    const lines: PdfLine[] = [
      line(457, [{ text: "No.", x: 77 }]),
      line(457, [{ text: "Item/Service Name", x: 114 }]),
      line(457, [{ text: "Quantity UOM", x: 259 }]),
      line(457, [{ text: "Subtotal Price", x: 338 }]),
      line(457, [{ text: "Subtotal Value", x: 453 }]),
      line(486, [{ text: "1", x: 80 }]),
      line(486, [{ text: "259255", x: 133 }]),
      line(493, [{ text: "2", x: 76 }]),
      line(494, [{ text: "SPC Rigid Vinyl Floor, Country Wood,", x: 103 }]),
      line(496, [{ text: "76,85", x: 269 }, { text: "m", x: 292 }]),
      line(496, [{ text: "15,43", x: 352 }]),
      line(496, [{ text: "1", x: 487 }, { text: "185,80", x: 494 }]),
      line(501, [{ text: "5,7mm La Boheme 55 inkl. 1,7 mm", x: 105 }]),
      line(519, [{ text: "2", x: 80 }]),
      line(519, [{ text: "SL2592/SL3285", x: 117 }]),
      line(519, [{ text: "38", x: 275 }, { text: "szt", x: 286 }]),
      line(519, [{ text: "3,96", x: 355 }]),
      line(519, [{ text: "150,48", x: 494 }]),
      line(527, [{ text: "Skirtings, Country wood, 14,", x: 113 }]),
      line(544, [{ text: "3", x: 80 }]),
      line(544, [{ text: "3085", x: 138 }]),
      line(544, [{ text: "10", x: 275 }, { text: "szt", x: 286 }]),
      line(544, [{ text: "5,99", x: 355 }]),
      line(544, [{ text: "59,90", x: 498 }]),
      line(552, [{ text: "CLIPHOLDER SKIRTINGS, CLIPHOLDER,", x: 101 }]),
      line(570, [{ text: "4", x: 80 }]),
      line(570, [{ text: "Transport", x: 129 }]),
      line(570, [{ text: "1", x: 277 }, { text: "szt", x: 284 }]),
      line(570, [{ text: "250", x: 356 }]),
      line(570, [{ text: "2", x: 494 }]),
      line(570, [{ text: "5", x: 503 }]),
      line(570, [{ text: "0,00", x: 514 }]),
      line(633, [{ text: "Including:", x: 204 }]),
      line(633, [{ text: "1 646,18", x: 351 }]),
    ];

    const structured: PdfStructured = {
      sourceFileName: "commercial offer.pdf",
      pages: [
        {
          index: 0,
          width: 595,
          height: 842,
          lines,
          rawText: "ECONFLOOR POLSKA\noffice@econfloorpolska.com\nCommercial Offer",
        },
      ],
    };

    const { items } = extractEconFloorItems(structured);
    expect(items.length).toBe(4);
    expect(items[0]?.article_number).toBe("259255");
    expect(items[0]?.quantity).toBe(76.85);
    expect(items[0]?.unit).toBe("m2");
    expect(items[0]?.unit_price).toBe(15.43);
    expect(items[0]?.line_total).toBe(1185.8);
    expect(items[0]?.description).toContain("SPC Rigid Vinyl");
    expect(items[1]?.article_number).toBe("SL2592/SL3285");
    expect(items[1]?.quantity).toBe(38);
    expect(items[1]?.unit).toMatch(/szt/i);
    expect(items[2]?.article_number).toBe("3085");
    expect(items[3]?.description).toContain("Transport");
    expect(items[3]?.quantity).toBe(1);
    expect(items[3]?.unit_price).toBe(250);
    expect(items[3]?.line_total).toBe(250);
  });
});

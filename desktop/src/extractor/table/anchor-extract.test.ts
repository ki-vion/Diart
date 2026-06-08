import { describe, expect, it } from "vitest";
import type { PdfStructured } from "../../pdf/types";
import { LAIER_VAN_TEMPLATE, RK_STARK_TEMPLATE } from "../pipeline/templates";
import { columnContextFromTemplate } from "./column-block";
import { extractAnchoredItems } from "./anchor-extract";
import { findTableRegionOrContinuation } from "./table-region";
import { findBlockAnchors } from "./item-blocks";

function w(text: string, x: number, y: number, fontSize = 9.96) {
  return { text, x, y, fontSize };
}

function textLine(y: number, parts: ReturnType<typeof w>[]) {
  return { y, words: parts, text: parts.map((p) => p.text).join(" ") };
}

describe("extractAnchoredItems (RK page slice)", () => {
  const page1Lines = [
    textLine(103, [w("Gedrucktam", 277, 103, 6)]),
    textLine(210, [
      w("POS.", 42, 210),
      w("ARTIKEL-NR.", 80, 210),
      w("MENGE", 300, 210),
      w("EINZEL-PREIS", 380, 210),
    ]),
    textLine(222, [w("ARTIKELBEZEICHNUNG", 76, 222), w("INEUR", 200, 222)]),
    textLine(236, [
      w("00010", 42, 236),
      w("9802917", 76, 236),
      w("29ST", 300, 236),
      w("66,70EUR/1ST", 380, 236),
    ]),
    textLine(248, [w("Doppelstabmatte", 76, 248), w("1.934,30", 470, 248)]),
    textLine(621, [
      w("00040", 42, 621),
      w("1040847", 76, 621),
      w("5SA", 300, 621),
    ]),
    textLine(633, [w("RAWBetonestrichfein", 76, 633)]),
    textLine(775, [w("RaabKarcher", 222, 775, 6)]),
  ];

  const structured: PdfStructured = {
    pages: [{ index: 1, width: 595, height: 842, rawText: "", lines: page1Lines }],
  };

  it("finds table region with dataEnd before footer", () => {
    const region = findTableRegionOrContinuation(structured.pages[0]!);
    expect(region).not.toBeNull();
    expect(region!.dataEndIndex).toBeLessThan(page1Lines.length);
    const anchors = findBlockAnchors(page1Lines, region!.dataStartIndex).filter(
      (a) => a.lineIndex < region!.dataEndIndex,
    );
    expect(anchors.length).toBeGreaterThanOrEqual(2);
  });

  it("extracts RK positions from structured page", () => {
    const columnBlock = columnContextFromTemplate(RK_STARK_TEMPLATE, structured.pages);
    const items = extractAnchoredItems(structured, { layout_id: "RAAB Karcher", columnBlock });
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.some((i) => i.position === "00010")).toBe(true);
    expect(items.some((i) => i.position === "00040")).toBe(true);
  });

  it("00010 includes article number and multi-line spec (DIART layout)", () => {
    const diartPage1 = [
      textLine(210, [w("POS.", 42, 210), w("ARTIKEL-NR.", 76, 210), w("MENGE", 300, 210)]),
      textLine(236, [w("00010", 42, 236)]),
      textLine(236.01, [w("9802917", 76, 236)]),
      textLine(236.02, [w("<B>", 132, 236)]),
      textLine(236.03, [w("29", 306, 236), w("ST", 330, 236)]),
      textLine(236.04, [w("66,70", 391, 236)]),
      textLine(236.05, [w("EUR/1", 391, 236), w("ST", 430, 236)]),
      textLine(248, [w("Doppelstabmatte", 76, 248), w("schwere", 120, 248), w("Ausführung", 160, 248)]),
      textLine(248.01, [w("1.934,30", 505, 248)]),
      textLine(263, [
        w("2508x1830", 76, 263),
        w("mm,", 130, 263),
        w("MW", 160, 263),
        w("50x200", 190, 263),
        w("mm,", 220, 263),
        w("Typ", 240, 263),
        w("8/6/8,", 248, 263),
      ]),
      textLine(275, [w("feuerverzinkt", 76, 275)]),
      textLine(313, [w("00020", 42, 313), w("9802917", 76, 313)]),
    ];

    const structured: PdfStructured = {
      pages: [
        {
          index: 0,
          width: 595,
          height: 842,
          rawText: "",
          lines: [
            textLine(103, [w("Gedrucktam", 277, 103, 6)]),
            ...diartPage1,
          ],
        },
      ],
    };

    const columnBlock = columnContextFromTemplate(RK_STARK_TEMPLATE, structured.pages);
    const items = extractAnchoredItems(structured, { layout_id: "RAAB Karcher", columnBlock });
    const item = items.find((i) => i.position === "00010");
    expect(item?.description).toMatch(/^9802917\n/);
    expect(item?.description).toContain("2508x1830");
    expect(item?.description).toContain("feuerverzinkt");
    expect(item?.line_total).toBe(1934.3);
  });
});

describe("extractAnchoredItems (Laier R-code page span)", () => {
  const yHeader = 262;
  const laierHeader = [
    textLine(yHeader, [w("Artikel", 42, yHeader)]),
    textLine(yHeader, [w("Menge", 321, yHeader)]),
    textLine(yHeader, [w("Einheit", 353, yHeader)]),
    textLine(yHeader, [w("VK-Preis", 409, yHeader)]),
    textLine(yHeader, [w("Betrag", 532, yHeader)]),
  ];

  it("merges R000008 anchor on page 1 with billing on page 2", () => {
    const page0 = [
      ...laierHeader,
      textLine(400, [w("55510010", 42, 400)]),
      textLine(412, [w("2", 344, 412), w("Stück", 353, 412), w("10,00", 416, 412), w("20,00", 532, 412)]),
      textLine(715, [w("R000008 *", 42, 715)]),
      textLine(798, [w("Rudolf Laier GmbH", 42, 798, 6)]),
    ];
    const page1 = [
      textLine(143, [w("Rudolf Laier GmbH · Am Bild 1", 60, 143)]),
      ...laierHeader,
      textLine(274, [w("Maut", 42, 274)]),
      textLine(274, [w("1", 344, 274), w("Stück", 353, 274), w("160,05", 416, 274), w("160,05", 532, 274)]),
      textLine(400, [w("Total EUR ohne MwSt.", 42, 400)]),
    ];

    const structured: PdfStructured = {
      pages: [
        { index: 0, width: 595, height: 842, rawText: "", lines: page0 },
        { index: 1, width: 595, height: 842, rawText: "", lines: page1 },
      ],
    };

    const columnBlock = columnContextFromTemplate(LAIER_VAN_TEMPLATE, [structured.pages[0]!]);
    const items = extractAnchoredItems(structured, {
      layout_id: "Rudolf Laier GmbH",
      columnBlock,
    });

    const maut = items.find((i) => i.article_number === "R000008");
    expect(maut).toBeDefined();
    expect(maut?.description).toContain("Maut");
    expect(maut?.quantity).toBe(1);
    expect(maut?.line_total).toBeCloseTo(160.05, 2);
  });
});

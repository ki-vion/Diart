import { describe, expect, it } from "vitest";
import type { PdfStructured } from "../../pdf/types";
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
    const items = extractAnchoredItems(structured, "rk_stark");
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.some((i) => i.position === "00010")).toBe(true);
    expect(items.some((i) => i.position === "00040")).toBe(true);
  });
});

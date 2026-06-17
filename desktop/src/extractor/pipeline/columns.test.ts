import { describe, expect, it } from "vitest";
import { calibrateColumnWindows, isVkDiscountToken, lineToCells } from "./columns";
import type { PdfLine } from "../../pdf/types";
import { LAIER_VAN_TEMPLATE, RK_STARK_TEMPLATE } from "./templates";

function line(text: string, wordSpecs: { t: string; x: number }[]): PdfLine {
  const words = wordSpecs.map((w) => ({
    text: w.t,
    x: w.x,
    y: 400,
    fontSize: 10,
  }));
  return { y: 400, words, text };
}

describe("isVkDiscountToken", () => {
  it("detects discount suffix tokens", () => {
    expect(isVkDiscountToken("--4")).toBe(true);
    expect(isVkDiscountToken("-3 %")).toBe(true);
    expect(isVkDiscountToken("%")).toBe(true);
    expect(isVkDiscountToken("40,50")).toBe(false);
  });
});

describe("lineToCells", () => {
  const windows = RK_STARK_TEMPLATE.defaultWindows;

  it("keeps full Alternativposition line in description including 0010", () => {
    const cells = lineToCells(
      line("Alternativposition zu Position 0010", [
        { t: "Alternativposition", x: 42 },
        { t: "zu", x: 90 },
        { t: "Position", x: 110 },
        { t: "0010", x: 172 },
      ]),
      windows,
      RK_STARK_TEMPLATE.descriptionCatchAllMaxX,
    );

    expect(cells.description).toBe("Alternativposition zu Position 0010");
  });

  it("assigns right-aligned RK quantity and unit in Menge band", () => {
    const windows = calibrateColumnWindows(
      [],
      RK_STARK_TEMPLATE.headerHints,
      RK_STARK_TEMPLATE.defaultWindows,
      "RAAB Karcher",
    );

    const qtyLine = line("105", [{ t: "105", x: 300.72 }]);
    const unitLine = line("M2", [{ t: "M2", x: 323.16 }]);
    const priceLine = line("13,38", [{ t: "13,38", x: 391.56 }]);
    const totalLine = line("1.404,90", [{ t: "1.404,90", x: 505.08 }]);

    expect(lineToCells(qtyLine, windows, 295).quantity).toBe("105");
    expect(lineToCells(unitLine, windows, 295).unit).toBe("M2");
    expect(lineToCells(priceLine, windows, 295).unitPrice).toBe("13,38");
    expect(lineToCells(totalLine, windows, 295).lineTotal).toBe("1.404,90");
  });

  it("keeps wide RK description band when header calibration is misleading", () => {
    const misleadingHeader: { lines: PdfLine[] }[] = [
      {
        lines: [
          line("POS. ARTIKEL-NR. ARTIKELBEZEICHNUNG MENGE", [
            { t: "POS.", x: 148 },
            { t: "ARTIKEL-NR.", x: 138 },
            { t: "ARTIKELBEZEICHNUNG", x: 138 },
            { t: "MENGE", x: 300 },
          ]),
        ],
      },
    ];

    const windows = calibrateColumnWindows(
      misleadingHeader,
      RK_STARK_TEMPLATE.headerHints,
      RK_STARK_TEMPLATE.defaultWindows,
      "RAAB Karcher",
    );

    const desc = windows.find((w) => w.role === "description");
    expect(desc?.xMax).toBeGreaterThanOrEqual(295);
    const pos = windows.find((w) => w.role === "position");
    expect(pos?.xMax).toBeGreaterThanOrEqual(65);
  });

  it("does not put VK discount into description leftover", () => {
    const windows = calibrateColumnWindows(
      [],
      LAIER_VAN_TEMPLATE.headerHints,
      LAIER_VAN_TEMPLATE.defaultWindows,
      "Rudolf Laier GmbH",
    );
    const cells = lineToCells(
      line("40,50 --4 %", [
        { t: "40,50", x: 420.95 },
        { t: "--4", x: 446.44 },
        { t: "%", x: 459.94 },
      ]),
      windows,
      310,
    );
    expect(cells.unitPrice).toBe("40,50");
    expect(cells.description).toBeUndefined();
  });
});

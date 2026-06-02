import { describe, expect, it } from "vitest";
import type { PdfLine } from "../../pdf/types";
import type { ColumnWindow } from "../pipeline/types";
import { RK_STARK_TEMPLATE } from "../pipeline/templates";
import {
  isPlausibleDescriptionLine,
  shouldStopBlockAtLine,
  trimBlockLines,
} from "./line-guards";

const LAIER_WINDOWS: ColumnWindow[] = [
  { role: "article", xMin: 0, xMax: 300 },
  { role: "description", xMin: 0, xMax: 310 },
  { role: "quantity", xMin: 300, xMax: 352 },
  { role: "unit", xMin: 340, xMax: 400 },
  { role: "unitPrice", xMin: 395, xMax: 510 },
  { role: "lineTotal", xMin: 500, xMax: 600 },
];

function wordLine(y: number, parts: { t: string; x: number }[]): PdfLine {
  const words = parts.map((p) => ({ text: p.t, x: p.x, y, fontSize: 10 }));
  return { y, words, text: parts.map((p) => p.t).join(" ") };
}

describe("shouldStopBlockAtLine", () => {
  it("does not stop on split Menge line at column boundary", () => {
    const qty = wordLine(488, [{ t: "57", x: 339.52 }]);
    expect(shouldStopBlockAtLine(qty, LAIER_WINDOWS)).toBe(false);
  });

  it("does not stop on a single line-total amount", () => {
    const total = wordLine(248, [{ t: "1.934,30", x: 505 }]);
    expect(shouldStopBlockAtLine(total, RK_STARK_TEMPLATE.defaultWindows)).toBe(false);
  });

  it("stops on Total EUR row spanning price columns", () => {
    const total = wordLine(441, [
      { t: "Total", x: 365 },
      { t: "EUR", x: 400 },
      { t: "1.633,65", x: 532 },
    ]);
    expect(shouldStopBlockAtLine(total, LAIER_WINDOWS)).toBe(true);
  });
});

describe("RK description band", () => {
  const rkWindows = RK_STARK_TEMPLATE.defaultWindows;

  it("treats long spec line as plausible description (wide Bezeichnung)", () => {
    const spec = wordLine(263, [
      { t: "2508x1830", x: 76 },
      { t: "mm,", x: 120 },
      { t: "MW", x: 150 },
      { t: "50x200", x: 180 },
      { t: "mm,", x: 210 },
      { t: "Typ", x: 230 },
      { t: "8/6/8,", x: 248 },
    ]);
    expect(isPlausibleDescriptionLine(spec, rkWindows)).toBe(true);
    expect(shouldStopBlockAtLine(spec, rkWindows)).toBe(false);
  });
});

describe("trimBlockLines", () => {
  it("keeps billing lines after article-id split row", () => {
    const lines = [
      wordLine(476, [{ t: "33011303", x: 42.52 }]),
      wordLine(488, [{ t: "Villerit InnoTherm Leichtkleber EPS 25kg", x: 42.52 }]),
      wordLine(488, [{ t: "57", x: 339.52 }]),
      wordLine(488, [{ t: "Sack", x: 353.49 }]),
      wordLine(488, [{ t: "11,85", x: 420.95 }]),
      wordLine(488, [{ t: "675,45", x: 532.84 }]),
    ];
    const trimmed = trimBlockLines(lines, { windows: LAIER_WINDOWS });
    expect(trimmed.map((l) => l.text.trim())).toEqual([
      "33011303",
      "Villerit InnoTherm Leichtkleber EPS 25kg",
      "57",
      "Sack",
      "11,85",
      "675,45",
    ]);
  });
});

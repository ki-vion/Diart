import { describe, expect, it } from "vitest";
import type { PdfLine } from "../../pdf/types";
import { RK_STARK_TEMPLATE } from "../pipeline/templates";
import { columnContextFromTemplate, parseColumnItemBlock } from "./column-block";

const X = {
  pos: 42,
  art: 100,
  desc: 76,
  qty: 310,
  unitPrice: 390,
  lineTotal: 470,
} as const;

function rkLine(y: number, parts: { text: string; x: number }[]): PdfLine {
  const words = parts.map((p) => ({ text: p.text, x: p.x, y, fontSize: 9.96 }));
  return { y, words, text: words.map((w) => w.text).join(" ") };
}

describe("parseColumnItemBlock", () => {
  const ctx = columnContextFromTemplate(RK_STARK_TEMPLATE, []);

  it("parses RK 00050-style block: billing qty from Menge column, 1 kg/Fl in description", () => {
    const item = parseColumnItemBlock(
      [
        rkLine(486, [{ text: "00050", x: X.pos }]),
        rkLine(486.1, [{ text: "330235", x: X.art }]),
        rkLine(486.2, [
          { text: "5", x: X.qty },
          { text: "FL", x: 330 },
        ]),
        rkLine(486.3, [{ text: "18,30", x: X.unitPrice }]),
        rkLine(486.4, [{ text: "EUR/1", x: X.unitPrice }, { text: "FL", x: 430 }]),
        rkLine(498, [{ text: "Fermacell Estrichkleber !Z", x: X.desc }]),
        rkLine(510, [
          { text: "1", x: X.desc },
          { text: "kg/Fl", x: 95 },
        ]),
        rkLine(498.1, [{ text: "91,50", x: X.lineTotal }]),
      ],
      ctx,
    );

    expect(item?.position).toBe("00050");
    expect(item?.article_number).toBe("330235");
    expect(item?.quantity).toBe(5);
    expect(item?.unit).toBe("FL");
    expect(item?.description).toContain("Fermacell Estrichkleber !Z");
    expect(item?.description).toContain("1 kg/Fl");
  });

  it("parses 00010-style block without billing noise in description", () => {
    const item = parseColumnItemBlock(
      [
        rkLine(236, [
          { text: "00010", x: X.pos },
          { text: "249706", x: X.art },
        ]),
        rkLine(248, [{ text: "105", x: X.qty }]),
        rkLine(260, [{ text: "=", x: X.desc }, { text: "70", x: 120 }]),
        rkLine(270, [{ text: "M2", x: X.desc }]),
        rkLine(280, [{ text: "ST", x: 330 }]),
        rkLine(290, [{ text: "13,38", x: X.unitPrice }]),
        rkLine(300, [{ text: "EUR/1", x: X.unitPrice }, { text: "M2", x: 430 }]),
        rkLine(310, [{ text: "1.404,90", x: X.lineTotal }]),
        rkLine(220, [{ text: "Fermacell Estrich-Wabe", x: X.desc }]),
        rkLine(230, [
          { text: "1500x1000x30", x: X.desc },
          { text: "mm", x: 150 },
          { text: "1500x1060mm", x: X.desc },
        ]),
        rkLine(240, [{ text: "Überlappend", x: X.desc }]),
      ],
      ctx,
    );

    expect(item?.position).toBe("00010");
    expect(item?.article_number).toBe("249706");
    expect(item?.quantity).toBe(105);
    expect(item?.description).toContain("Fermacell Estrich-Wabe");
    expect(item?.description).toContain("Überlappend");
    expect(item?.description).not.toMatch(/\b00010\b/);
    expect(item?.description).toMatch(/^249706\n/);
    expect(item?.description).not.toMatch(/^M2$/m);
    expect(item?.description).not.toMatch(/^ST$/m);
    expect(item?.description).not.toMatch(/^=$/m);
  });

  it("parses multi-line description from Bezeichnung column only", () => {
    const item = parseColumnItemBlock(
      [
        rkLine(435, [
          { text: "00040", x: X.pos },
          { text: "688939", x: X.art },
        ]),
        rkLine(435.1, [
          { text: "105", x: X.qty },
          { text: "M2", x: 330 },
        ]),
        rkLine(435.2, [{ text: "33,15", x: X.unitPrice }]),
        rkLine(435.3, [{ text: "EUR/1", x: X.unitPrice }, { text: "M2", x: 430 }]),
        rkLine(435.4, [{ text: "3.480,75", x: X.lineTotal }]),
        rkLine(447, [{ text: "Fermacell Estrich-Element", x: X.desc }]),
        rkLine(459, [{ text: "1500x500x45 mm", x: X.desc }]),
        rkLine(471, [{ text: "Mineralwolle in 20 mm Dicke", x: X.desc }]),
      ],
      ctx,
    );

    expect(item?.position).toBe("00040");
    expect(item?.description).toContain("Fermacell Estrich-Element");
    expect(item?.description).toContain("1500x500x45 mm");
    expect(item?.description).toContain("Mineralwolle");
    expect(item?.description.match(/\n/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("parses DIART 00010: billing on anchor row, multi-line spec after line total", () => {
    const item = parseColumnItemBlock(
      [
        rkLine(236, [{ text: "00010", x: X.pos }]),
        rkLine(236.1, [{ text: "9802917", x: X.art }]),
        rkLine(236.2, [{ text: "<B>", x: 132 }]),
        rkLine(236.3, [
          { text: "29", x: X.qty },
          { text: "ST", x: 330 },
        ]),
        rkLine(236.4, [{ text: "66,70", x: X.unitPrice }]),
        rkLine(236.5, [
          { text: "EUR/1", x: X.unitPrice },
          { text: "ST", x: 430 },
        ]),
        rkLine(248, [{ text: "Doppelstabmatte schwere Ausführung", x: X.desc }]),
        rkLine(248.1, [{ text: "1.934,30", x: X.lineTotal }]),
        rkLine(263, [
          {
            text: "2508x1830 mm, MW 50x200 mm, Typ 8/6/8,",
            x: X.desc,
          },
          { text: "mm", x: 150 },
          { text: "Typ", x: 220 },
        ]),
        rkLine(275, [{ text: "feuerverzinkt", x: X.desc }]),
      ],
      ctx,
    );

    expect(item?.position).toBe("00010");
    expect(item?.article_number).toBe("9802917");
    expect(item?.quantity).toBe(29);
    expect(item?.unit).toBe("ST");
    expect(item?.description).toMatch(/^9802917\n/);
    expect(item?.description).toContain("Doppelstabmatte schwere Ausführung");
    expect(item?.description).toContain("2508x1830 mm");
    expect(item?.description).toContain("feuerverzinkt");
    expect(item?.line_total).toBe(1934.3);
  });
});

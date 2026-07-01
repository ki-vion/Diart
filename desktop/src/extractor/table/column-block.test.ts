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

  it("parses 00010 with KG billing unit and ignores EIM packaging", () => {
    const item = parseColumnItemBlock(
      [
        rkLine(80, [
          { text: "00010", x: X.pos },
          { text: "1190364", x: X.art },
        ]),
        rkLine(92, [{ text: "18", x: X.qty }]),
        rkLine(94, [{ text: "=", x: X.desc }, { text: "1", x: 120 }]),
        rkLine(96, [{ text: "KG", x: 330 }]),
        rkLine(97, [{ text: "EIM", x: 330 }]),
        rkLine(98, [{ text: "1,21", x: X.unitPrice }]),
        rkLine(99, [
          { text: "EUR/1", x: X.unitPrice },
          { text: "KG", x: 430 },
        ]),
        rkLine(100, [{ text: "21,78", x: X.lineTotal }]),
        rkLine(82, [{ text: "Rigips ProMix Finish", x: X.desc }]),
        rkLine(83, [{ text: "Feinspachtelmasse 18 kg/Eim", x: X.desc }]),
      ],
      ctx,
    );

    expect(item?.position).toBe("00010");
    expect(item?.quantity).toBe(18);
    expect(item?.unit).toBe("KG");
    expect(item?.unit_price).toBe(1.21);
    expect(item?.line_total).toBe(21.78);
  });

  it("parses 00040 with ROL billing unit from qty line", () => {
    const item = parseColumnItemBlock(
      [
        rkLine(349, [
          { text: "00040", x: X.pos },
          { text: "1041010", x: X.art },
        ]),
        rkLine(349.1, [
          { text: "1", x: X.qty },
          { text: "ROL", x: 330 },
        ]),
        rkLine(349.2, [{ text: "7,58", x: X.unitPrice }]),
        rkLine(349.3, [
          { text: "EUR/1", x: X.unitPrice },
          { text: "ROL", x: 430 },
        ]),
        rkLine(349.4, [{ text: "7,58", x: X.lineTotal }]),
        rkLine(361, [{ text: "RAW PE Trennwandband B1 !Z", x: X.desc }]),
      ],
      ctx,
    );

    expect(item?.quantity).toBe(1);
    expect(item?.unit).toBe("ROL");
    expect(item?.description).not.toMatch(/^ROL$/m);
    expect(item?.description).toContain("RAW PE Trennwandband");
  });

  it("parses profile row with EUR/100 M and keeps M as billing unit", () => {
    const item = parseColumnItemBlock(
      [
        rkLine(462, [
          { text: "00060", x: X.pos },
          { text: "661065", x: X.art },
        ]),
        rkLine(462.1, [{ text: "160", x: X.qty }]),
        rkLine(462.2, [{ text: "M", x: 330 }]),
        rkLine(462.3, [{ text: "132,02", x: X.unitPrice }]),
        rkLine(462.4, [
          { text: "EUR/100", x: X.unitPrice },
          { text: "M", x: 430 },
        ]),
        rkLine(474, [{ text: "Rigips UW-Profil 75/40/0,6 mm", x: X.desc }]),
        rkLine(474.1, [
          { text: "=", x: X.desc },
          { text: "40", x: 120 },
        ]),
        rkLine(474.2, [{ text: "ST", x: 330 }]),
        rkLine(474.3, [{ text: "211,23", x: X.lineTotal }]),
      ],
      ctx,
    );

    expect(item?.quantity).toBe(160);
    expect(item?.unit).toBe("M");
    expect(item?.unit_price).toBe(132.02);
    expect(item?.price_per).toBe(100);
    expect(item?.line_total).toBe(211.23);
  });
});

import { describe, expect, it } from "vitest";
import { parseItemBlock } from "./item-blocks";
import type { PdfLine } from "../../pdf/types";
import { RK_STARK_TEMPLATE } from "../pipeline/templates";
import { columnContextFromTemplate } from "./column-block";

const X = { pos: 42, art: 100, desc: 76, qty: 310, unitPrice: 390, lineTotal: 470 };

function rkLine(y: number, parts: { text: string; x: number }[]): PdfLine {
  const words = parts.map((p) => ({ text: p.text, x: p.x, y, fontSize: 10 }));
  return { y, words, text: words.map((w) => w.text).join(" ") };
}

function textLine(y: number, text: string): PdfLine {
  const words = text.split(/\s+/).map((t, i) => ({
    text: t,
    x: 40 + i * 80,
    y,
    fontSize: 10,
  }));
  return { y, words, text };
}

describe("parseItemBlock", () => {
  const columnBlock = columnContextFromTemplate(RK_STARK_TEMPLATE, []);

  it("parses RK-style multi-line position blocks via X columns", () => {
    const item = parseItemBlock(
      [
        rkLine(200, [
          { text: "00010", x: X.pos },
          { text: "249706", x: X.art },
        ]),
        rkLine(240, [{ text: "105", x: X.qty }]),
        rkLine(260, [{ text: "ST", x: 330 }]),
        rkLine(280, [{ text: "13,38", x: X.unitPrice }]),
        rkLine(290, [{ text: "EUR/1", x: X.unitPrice }, { text: "M2", x: 430 }]),
        rkLine(300, [{ text: "1.404,90", x: 505 }]),
        rkLine(220, [{ text: "Fermacell Estrich-Wabe", x: X.desc }]),
        rkLine(230, [{ text: "1500x1000x30 mm", x: X.desc }]),
      ],
      [],
      {},
      { columnBlock },
    );

    expect(item?.position).toBe("00010");
    expect(item?.article_number).toBe("249706");
    expect(item?.quantity).toBe(105);
    expect(item?.unit_price).toBe(13.38);
    expect(item?.line_total).toBe(1404.9);
    expect(item?.description).toContain("Fermacell");
  });

  it("parses KAN-style stacked fields after anchor line", () => {
    const item = parseItemBlock(
      [
        textLine(100, "008 Artikelnummer: 0206050001"),
        textLine(110, "200"),
        textLine(120, "Stück"),
        textLine(130, "0,32"),
        textLine(140, "64,00"),
        textLine(150, "weber.therm Schraubdübel"),
      ],
      [],
      {},
    );

    expect(item?.position).toBe("008");
    expect(item?.article_number).toBe("0206050001");
    expect(item?.quantity).toBe(200);
    expect(item?.unit_price).toBe(0.32);
    expect(item?.line_total).toBe(64);
    expect(item?.description).toContain("weber");
  });
});

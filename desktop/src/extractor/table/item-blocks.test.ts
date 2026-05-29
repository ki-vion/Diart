import { describe, expect, it } from "vitest";
import { parseItemBlock } from "./item-blocks";
import type { PdfLine } from "../../pdf/types";

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
  it("parses RK-style multi-line position blocks", () => {
    const item = parseItemBlock(
      [
        textLine(200, "00010 249706"),
        textLine(210, "<B>"),
        textLine(220, "Fermacell Estrich-Wabe"),
        textLine(230, "1500x1000x30 mm"),
        textLine(240, "105"),
        textLine(250, "= 70"),
        textLine(260, "M2"),
        textLine(270, "ST"),
        textLine(280, "13,38"),
        textLine(290, "EUR/1 M2"),
        textLine(300, "1.404,90"),
      ],
      [],
      {},
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

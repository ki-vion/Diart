import { describe, expect, it } from "vitest";
import { formatArtikelCell } from "../../export/format-artikel";
import type { PdfLine } from "../../pdf/types";
import { calibrateColumnWindows, lineToCells } from "../pipeline/columns";
import { LAIER_VAN_TEMPLATE } from "../pipeline/templates";
import { columnContextFromTemplate } from "./column-block";
import {
  extractLaierArticleId,
  isLaierItemAnchor,
  parseLaierBlock,
  parseLaierColumnBlock,
} from "./laier-block";

function textLine(y: number, text: string, x = 40): PdfLine {
  const words = text.split(/\s+/).filter(Boolean).map((t, i) => ({
    text: t,
    x: x + i * 50,
    y,
    fontSize: 10,
  }));
  return { y, words, text };
}

function wordLine(y: number, specs: { t: string; x: number }[]): PdfLine {
  const words = specs.map((s) => ({ text: s.t, x: s.x, y, fontSize: 10 }));
  return { y, words, text: words.map((w) => w.text).join(" ") };
}

describe("extractLaierArticleId", () => {
  it("reads 8-digit ids and R surcharge codes", () => {
    expect(extractLaierArticleId("55510010 (Alternativposition)")).toBe("55510010");
    expect(extractLaierArticleId("R000008 *")).toBe("R000008");
  });
});

describe("isLaierItemAnchor", () => {
  it("accepts alternativposition blocks with qty on a later line", () => {
    const lines = [
      textLine(0, "55510010 (Alternativposition)"),
      textLine(12, " ( Preis per 100 )"),
      textLine(24, "Sockelschienen PLUS 1,0mm"),
      textLine(36, "2,500 m"),
      textLine(48, "428,40 --4 %"),
      textLine(60, "(10,28)"),
    ];
    expect(isLaierItemAnchor(lines, 0)).toBe(true);
  });

  it("accepts R-code surcharge rows", () => {
    const lines = [
      textLine(0, "R000008 *"),
      textLine(12, "Maut"),
      textLine(24, "1"),
      textLine(36, "Stück"),
      textLine(48, "31,64"),
      textLine(60, "31,64"),
    ];
    expect(isLaierItemAnchor(lines, 0)).toBe(true);
  });
});

describe("lineToCells laier columns", () => {
  const headerPages = [
    {
      lines: [
        wordLine(428, [
          { t: "Artikel", x: 42.52 },
          { t: "Menge", x: 321.02 },
          { t: "Einheit", x: 353.49 },
          { t: "VK-Preis", x: 408.93 },
          { t: "Betrag", x: 531.83 },
        ]),
      ],
    },
  ];
  const windows = calibrateColumnWindows(
    headerPages,
    LAIER_VAN_TEMPLATE.headerHints,
    LAIER_VAN_TEMPLATE.defaultWindows,
    "Rudolf Laier GmbH",
  );

  it("assigns right-aligned Menge and Einheit, not Artikel text", () => {
    const desc = wordLine(488, [{ t: "Villerit InnoTherm Leichtkleber EPS 25kg", x: 42.52 }]);
    const qty = wordLine(488, [{ t: "57", x: 339.52 }]);
    const unit = wordLine(488, [{ t: "Sack", x: 353.49 }]);

    expect(lineToCells(desc, windows, 310).description).toContain("Villerit");
    expect(lineToCells(desc, windows, 310).quantity).toBeUndefined();
    expect(lineToCells(qty, windows, 310).quantity).toBe("57");
    expect(lineToCells(qty, windows, 310).description).toBeUndefined();
    expect(lineToCells(unit, windows, 310).unit).toBe("Sack");
  });
});

describe("parseLaierColumnBlock", () => {
  const ctx = columnContextFromTemplate(LAIER_VAN_TEMPLATE, [
    {
      lines: [
        wordLine(428, [
          { t: "Artikel", x: 42.52 },
          { t: "Menge", x: 321.02 },
          { t: "Einheit", x: 353.49 },
          { t: "VK-Preis", x: 408.93 },
          { t: "Betrag", x: 531.83 },
        ]),
      ],
    },
  ]);

  it("assigns Betrag column totals", () => {
    const cells = lineToCells(
      wordLine(488, [{ t: "675,45", x: 532.84 }]),
      ctx.windows,
      310,
    );
    expect(cells.lineTotal).toBe("675,45");
  });

  it("reads qty/unit from column bands on split lines", () => {
    const item = parseLaierColumnBlock(
      [
        wordLine(476, [{ t: "33011303", x: 42.52 }]),
        wordLine(488, [{ t: "Villerit InnoTherm Leichtkleber EPS 25kg", x: 42.52 }]),
        wordLine(488, [{ t: "57", x: 339.52 }]),
        wordLine(488, [{ t: "Sack", x: 353.49 }]),
        wordLine(488, [{ t: "11,85", x: 420.95 }]),
        wordLine(488, [{ t: "675,45", x: 532.84 }]),
      ],
      ctx,
    );
    expect(item?.article_number).toBe("33011303");
    expect(item?.quantity).toBe(57);
    expect(item?.unit).toBe("Sack");
    expect(item?.unit_price).toBe(11.85);
    expect(item?.line_total).toBe(675.45);
    expect(item?.description).toContain("Villerit");
  });

  it("does not duplicate (Alternativposition) from anchor line column split", () => {
    const item = parseLaierColumnBlock(
      [
        wordLine(680, [
          { t: "22508050", x: 42.52 },
          { t: "(Alternativposition)", x: 60 },
        ]),
        wordLine(703, [{ t: "Sockeldämmplatte 035 160x1000x500mm", x: 42.52 }]),
        wordLine(715, [{ t: "1", x: 326.99 }]),
        wordLine(715, [{ t: "Bund", x: 353.49 }]),
        wordLine(715, [{ t: "10,00", x: 420.95 }]),
        wordLine(715, [{ t: "(10,00)", x: 536.8 }]),
      ],
      ctx,
    );
    expect(item?.description).toBe(
      "(Alternativposition)\nSockeldämmplatte 035 160x1000x500mm",
    );
    expect(
      formatArtikelCell(
        { article_number: item!.article_number, description: item!.description },
        { layoutId: "Rudolf Laier GmbH" },
      ),
    ).toBe(
      "22508050 (Alternativposition)\nSockeldämmplatte 035 160x1000x500mm",
    );
  });

  it("keeps (Alternativposition) from anchor line in Artikel export", () => {
    const item = parseLaierColumnBlock(
      [
        wordLine(680, [{ t: "55501726", x: 42.52 }, { t: "(Alternativposition)", x: 60 }]),
        wordLine(680, [
          { t: "(", x: 222 },
          { t: "Preis", x: 230 },
          { t: "per", x: 250 },
          { t: "100", x: 270 },
          { t: ")", x: 280 },
        ]),
        wordLine(691, [{ t: "Anputzleiste mit Gewebe", x: 42.52 }]),
        wordLine(691, [{ t: "2,600", x: 326.99 }]),
        wordLine(691, [{ t: "m", x: 353.49 }]),
        wordLine(691, [{ t: "88,00", x: 420.95 }]),
        wordLine(691, [{ t: "(2,20)", x: 536.8 }]),
      ],
      ctx,
    );
    expect(item?.article_number).toBe("55501726");
    expect(item?.description).toContain("(Alternativposition)");
  });

  it("parses Rechnung row with single-dash discount and split m²", () => {
    const item = parseLaierColumnBlock(
      [
        wordLine(515, [{ t: "22860077", x: 44.53 }]),
        wordLine(527, [
          { t: "Enertherm ALU PURE Kellerdecken", x: 44.53 },
          { t: "1200x", x: 180 },
          { t: "600x", x: 210 },
          { t: "80mm", x: 240 },
        ]),
        wordLine(527, [{ t: "²", x: 76 }]),
        wordLine(527, [{ t: "43,20000", x: 313.95 }]),
        wordLine(527, [{ t: "m", x: 355.5 }]),
        wordLine(527, [{ t: "19,30", x: 422.96 }]),
        wordLine(527, [{ t: "-3", x: 448.45 }, { t: "%", x: 458.95 }]),
        wordLine(527, [{ t: "808,75", x: 534.85 }]),
        wordLine(538, [{ t: "ALU / 023 / TG = Nut & Feder", x: 44.53 }]),
        wordLine(551, [{ t: "1 Pal. (à 10 Bund)", x: 44.53 }]),
      ],
      ctx,
    );
    expect(item?.article_number).toBe("22860077");
    expect(item?.quantity).toBeCloseTo(43.2, 2);
    expect(item?.unit).toBe("m²");
    expect(item?.unit_price).toBeCloseTo(19.3, 2);
    expect(item?.line_total).toBeCloseTo(808.75, 2);
    expect(item?.description).toContain("Enertherm");
    expect(item?.description).not.toMatch(/-3\s*%/);
  });

  it("parses VWS-Gewebe with split m² packaging and Preis per 100", () => {
    const item = parseLaierColumnBlock(
      [
        wordLine(560, [{ t: "55521230", x: 42.52 }]),
        wordLine(560, [
          { t: "(", x: 222 },
          { t: "Preis", x: 230 },
          { t: "per", x: 250 },
          { t: "100", x: 270 },
          { t: ")", x: 280 },
        ]),
        wordLine(572, [{ t: "VWS-Gewebe", x: 42.52 }, { t: "165gr", x: 90 }, { t: "weiß", x: 120 }, { t: "1,10m", x: 170 }]),
        wordLine(572, [{ t: "²", x: 76 }]),
        wordLine(572, [{ t: "165,0000", x: 312.02 }]),
        wordLine(572, [{ t: "m", x: 353.49 }]),
        wordLine(572, [{ t: "66,00", x: 420.95 }]),
        wordLine(572, [{ t: "108,90", x: 532.84 }]),
        wordLine(584, [{ t: "3", x: 42.52 }, { t: "Rolle(n)", x: 55 }, { t: "(à", x: 80 }, { t: "55", x: 95 }, { t: "m", x: 105 }]),
        wordLine(584, [{ t: "²)", x: 120.04 }]),
      ],
      ctx,
    );
    expect(item?.article_number).toBe("55521230");
    expect(item?.description).toContain("1,10m");
    expect(item?.description).not.toContain("1,10m²");
    expect(item?.description).toContain("3 Rolle(n) (à 55 m²)");
    expect(item?.description).toContain("(Preis per 100)");
    expect(item?.price_per).toBe(100);
    expect(item?.quantity).toBe(165);
    expect(item?.unit).toBe("m²");
  });

  it("keeps VK discount out of Artikel and adds Preis per 100", () => {
    const item = parseLaierColumnBlock(
      [
        wordLine(560, [{ t: "55610915", x: 42.52 }]),
        wordLine(560, [{ t: "(", x: 222 }, { t: "Preis", x: 230 }, { t: "per", x: 250 }, { t: "100", x: 270 }, { t: ")", x: 280 }]),
        wordLine(572, [{ t: "Schraubdübel", x: 42.52 }, { t: "155mm", x: 90 }, { t: "STR-U-2G", x: 130 }]),
        wordLine(572, [{ t: "1.100", x: 312.02 }]),
        wordLine(572, [{ t: "Stück", x: 353.49 }]),
        wordLine(572, [{ t: "40,50", x: 420.95 }]),
        wordLine(572, [{ t: "--4", x: 446.44 }, { t: "%", x: 459.94 }]),
        wordLine(572, [{ t: "427,68", x: 531.83 }]),
        wordLine(584, [{ t: "11", x: 42.52 }, { t: "Karton", x: 55 }, { t: "(à", x: 80 }, { t: "100", x: 95 }, { t: "Stück)", x: 110 }]),
        wordLine(600, [{ t: "Sonstiges", x: 42.52 }, { t: "Zubehör:", x: 80 }]),
      ],
      ctx,
    );
    expect(item?.article_number).toBe("55610915");
    expect(item?.description).toContain("Schraubdübel");
    expect(item?.description).toContain("11 Karton");
    expect(item?.description).toContain("(Preis per 100)");
    expect(item?.description).not.toMatch(/--\s*4\s*%/);
    expect(item?.description).not.toContain("Sonstiges");
    expect(item?.quantity).toBe(1100);
    expect(item?.unit).toBe("Stück");
    expect(item?.unit_price).toBe(40.5);
    expect(item?.price_per).toBe(100);
  });
});

describe("parseLaierBlock", () => {
  it("parses alternativposition layout", () => {
    const item = parseLaierBlock([
      "55510010 (Alternativposition)",
      " ( Preis per 100 )",
      "Sockelschienen PLUS 1,0mm  100mm  2,50 m",
      "2,500 m",
      "428,40 --4 %",
      "(10,28)",
      "1 Stück (à 2,5 m)",
    ]);
    expect(item?.article_number).toBe("55510010");
    expect(item?.description).toContain("Sockelschienen");
    expect(item?.description).toContain("(Preis per 100)");
    expect(item?.description).not.toContain("--4");
    expect(item?.price_per).toBe(100);
    expect(item?.quantity).toBe(2.5);
    expect(item?.unit).toBe("m");
    expect(item?.unit_price).toBe(428.4);
    expect(item?.line_total).toBe(10.28);
  });

  it("parses split Menge and Einheit lines", () => {
    const item = parseLaierBlock([
      "33011303",
      "Villerit InnoTherm Leichtkleber EPS 25kg",
      "57",
      "Sack",
      "11,85",
      "675,45",
    ]);
    expect(item?.quantity).toBe(57);
    expect(item?.unit).toBe("Sack");
  });

  it("parses Rechnung text with single-dash VK discount", () => {
    const item = parseLaierBlock([
      "22860077",
      "Enertherm ALU PURE Kellerdecken  1200x 600x 80mm",
      "43,20000 m²",
      "19,30 -3 %",
      "808,75",
      "1 Pal. (à 10 Bund)",
    ]);
    expect(item?.quantity).toBeCloseTo(43.2, 2);
    expect(item?.unit).toBe("m²");
    expect(item?.unit_price).toBeCloseTo(19.3, 2);
    expect(item?.line_total).toBeCloseTo(808.75, 2);
  });

  it("parses compact rows without parentheses total", () => {
    const item = parseLaierBlock([
      "33032521",
      "Villerit Stockputz",
      "16 Sack",
      "10,72",
      "171,52",
    ]);
    expect(item?.article_number).toBe("33032521");
    expect(item?.quantity).toBe(16);
    expect(item?.unit).toBe("Sack");
    expect(item?.unit_price).toBe(10.72);
    expect(item?.line_total).toBe(171.52);
  });
});

import { describe, expect, it } from "vitest";
import {
  collectKanLeadingIntro,
  splitBlockLinesForParsing,
} from "./block-gaps";
import { extractBlocksFromPage } from "./item-blocks";
import type { PdfLine } from "../../pdf/types";

function line(y: number, text: string): PdfLine {
  return {
    y,
    text,
    words: [{ text, x: 42, y, fontSize: 10 }],
  };
}

describe("splitBlockLinesForParsing", () => {
  it("detaches only Alternativposition, keeps *** highlight on current item", () => {
    const block = [
      line(409, "99020"),
      line(409, "9800928"),
      line(421, "4-eck Geflecht verzinkt Rolle 25 m"),
      line(436, "50x2.5x1750 mm. Normalwicklung,"),
      line(448, "***starkverzinkt***"),
      line(486, "Alternativposition zu Position 0010"),
    ];

    const { parseLines, carryToNext } = splitBlockLinesForParsing(block);

    expect(parseLines.map((l) => l.text)).toEqual([
      "99020",
      "9800928",
      "4-eck Geflecht verzinkt Rolle 25 m",
      "50x2.5x1750 mm. Normalwicklung,",
      "***starkverzinkt***",
    ]);
    expect(carryToNext.map((l) => l.text)).toEqual([
      "Alternativposition zu Position 0010",
    ]);
  });

  it("collects intro lines immediately before a KAN anchor", () => {
    const lines = [
      line(460, "Als Alternative schlagen wir"),
      line(470, "folgenden Artikel vor:"),
      line(490, "019"),
      line(500, "Artikelnummer: 0206050001"),
    ];
    expect(collectKanLeadingIntro(lines, 2, 0).map((l) => l.text)).toEqual([
      "Als Alternative schlagen wir",
      "folgenden Artikel vor:",
    ]);
  });

  it("detaches KAN alternative intro lines for the next position", () => {
    const block = [
      line(400, "001 Artikelnummer: 0206050001"),
      line(410, "10"),
      line(420, "St"),
      line(430, "1,00"),
      line(440, "10,00"),
      line(450, "weber.prim 400"),
      line(460, "Als Alternative schlagen wir"),
      line(470, "folgenden Artikel vor:"),
    ];

    const { parseLines, carryToNext } = splitBlockLinesForParsing(block);

    expect(parseLines.map((l) => l.text)).toEqual([
      "001 Artikelnummer: 0206050001",
      "10",
      "St",
      "1,00",
      "10,00",
      "weber.prim 400",
    ]);
    expect(carryToNext.map((l) => l.text)).toEqual([
      "Als Alternative schlagen wir",
      "folgenden Artikel vor:",
    ]);
  });
});

describe("extractBlocksFromPage carry-over", () => {
  it("puts Alternativposition on next position as artikel_prefix", () => {
    const page = {
      lines: [
        line(200, "POS. ARTIKEL-NR. MENGE"),
        line(210, "ARTIKELBEZEICHNUNG"),
        line(236, "99020 9800928"),
        line(236, "3 ST"),
        line(236, "194,40"),
        line(236, "EUR/1 ST"),
        line(421, "4-eck Geflecht verzinkt Rolle 25 m"),
        line(436, "50x2.5x1750 mm. Normalwicklung,"),
        line(448, "***starkverzinkt***"),
        line(486, "Alternativposition zu Position 0010"),
        line(501, "99030 9800928"),
        line(501, "31 ST"),
        line(501, "23,81"),
        line(501, "EUR/1 ST"),
        line(515, "Zaunpfahl HADRA feuerverzinkt"),
      ],
    };

    const region = {
      headerStart: 0,
      headerEnd: 1,
      dataStartIndex: 2,
      dataEndIndex: page.lines.length,
      boundaries: [] as number[],
      columnMap: {},
    };

    const items = extractBlocksFromPage(page, region);
    const pos99020 = items.find((i) => i.position === "99020");
    const pos99030 = items.find((i) => i.position === "99030");

    expect(pos99020?.description).toContain("starkverzinkt");
    expect(pos99020?.description).not.toContain("Alternativposition");
    expect(pos99020?.artikel_prefix).toBeNull();

    expect(pos99030?.artikel_prefix).toMatch(/Alternativposition zu Position\s+0010/);
    expect(pos99030?.description).not.toContain("starkverzinkt");
    expect(pos99030?.description).not.toContain("Alternativposition");
  });

  it("puts KAN alternative intro on the next position as artikel_prefix", () => {
    const page = {
      lines: [
        line(400, "Pos. Bezeichnung Menge"),
        line(410, "001 Artikelnummer: 1111111111"),
        line(420, "10"),
        line(430, "St"),
        line(440, "1,00"),
        line(450, "10,00"),
        line(460, "Hauptartikel"),
        line(470, "Als Alternative schlagen wir"),
        line(480, "folgenden Artikel vor:"),
        line(490, "002"),
        line(500, "Artikelnummer: 0206050001"),
        line(510, "5"),
        line(520, "St"),
        line(530, "2,00"),
        line(540, "10,00"),
        line(550, "weber.star 224"),
        line(560, "alternativ"),
        line(570, "weiß, 25/Sack"),
      ],
    };

    const region = {
      headerStart: 0,
      headerEnd: 0,
      dataStartIndex: 1,
      dataEndIndex: page.lines.length,
      boundaries: [] as number[],
      columnMap: {},
    };

    const items = extractBlocksFromPage(page, region);
    const pos001 = items.find((i) => i.position === "001");
    const pos002 = items.find((i) => i.position === "002");

    expect(pos001?.description).toBe("Hauptartikel");
    expect(pos001?.artikel_prefix).toBeNull();
    expect(pos002?.artikel_prefix).toBe(
      "Als Alternative schlagen wir\nfolgenden Artikel vor:",
    );
    expect(pos002?.description).toBe("weber.star 224\nweiß, 25/Sack");
  });

  it("attaches intro before first anchor on a continuation page (dataStart)", () => {
    const page = {
      lines: [
        line(200, "Übertrag von Seite 2"),
        line(210, "Pos. Bezeichnung"),
        line(220, "Als Alternative schlagen wir"),
        line(230, "folgenden Artikel vor:"),
        line(240, "019"),
        line(250, "Artikelnummer: 0206050001"),
        line(260, "47"),
        line(270, "Sack"),
        line(280, "10,00"),
        line(290, "470,00"),
        line(300, "weber.star 224"),
      ],
    };

    const region = {
      headerStart: 1,
      headerEnd: 1,
      dataStartIndex: 2,
      dataEndIndex: page.lines.length,
      boundaries: [] as number[],
      columnMap: {},
    };

    const items = extractBlocksFromPage(page, region);
    expect(items).toHaveLength(1);
    expect(items[0]?.position).toBe("019");
    expect(items[0]?.artikel_prefix).toBe(
      "Als Alternative schlagen wir\nfolgenden Artikel vor:",
    );
  });
});

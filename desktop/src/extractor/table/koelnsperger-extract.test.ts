import { describe, expect, it } from "vitest";
import type { PdfLine, PdfStructured } from "../../pdf/types";
import { extractKoelnspergerItems } from "./koelnsperger-extract";
import { KOELNSPERGER_POSITION_RE, isKoelnspergerArticleValue, looksLikeKoelnspergerArticle } from "./koelnsperger-anchors";

function line(y: number, parts: Array<{ text: string; x: number }>): PdfLine {
  const words = parts.map((p) => ({ ...p, y, fontSize: 10 }));
  return { y, words, text: words.map((w) => w.text).join(" ") };
}

describe("KOELNSPERGER_POSITION_RE", () => {
  it("accepts dotted positions", () => {
    expect(KOELNSPERGER_POSITION_RE.test("1.")).toBe(true);
    expect(KOELNSPERGER_POSITION_RE.test("18.")).toBe(true);
    expect(KOELNSPERGER_POSITION_RE.test("1")).toBe(false);
  });
});

describe("looksLikeKoelnspergerArticle", () => {
  it("accepts 14-digit, D- and L-codes", () => {
    expect(looksLikeKoelnspergerArticle("00000002738308")).toBe(true);
    expect(looksLikeKoelnspergerArticle("D9304")).toBe(true);
    expect(looksLikeKoelnspergerArticle("L-0002")).toBe(true);
    expect(looksLikeKoelnspergerArticle("252494")).toBe(false);
  });
});

describe("isKoelnspergerArticleValue", () => {
  it("accepts classic and free-form supplier codes", () => {
    expect(isKoelnspergerArticleValue("00000002738308")).toBe(true);
    expect(isKoelnspergerArticleValue("MT110-100ST-1.5")).toBe(true);
    expect(isKoelnspergerArticleValue("AP")).toBe(true);
    expect(isKoelnspergerArticleValue("BM-OSB15MM")).toBe(true);
    expect(isKoelnspergerArticleValue("1.")).toBe(false);
    expect(isKoelnspergerArticleValue("180")).toBe(false);
  });
});

describe("extractKoelnspergerItems", () => {
  it("extracts split rows with multi-line description", () => {
    const yHeader = 487;
    const yRow = 500;
    const yDesc = 510;
    const yDisc = 522;
    const lines: PdfLine[] = [
      line(yHeader, [{ text: "Pos.", x: 60 }]),
      line(yHeader, [{ text: "Art-Nr.", x: 82 }]),
      line(yHeader, [{ text: "Artikel Bezeichnung", x: 150 }]),
      line(yHeader, [{ text: "Mge.", x: 371 }]),
      line(yHeader, [{ text: "Einh.", x: 402 }]),
      line(yHeader, [{ text: "E-Preis (€)", x: 441 }]),
      line(yHeader, [{ text: "Rabatt", x: 486 }]),
      line(yHeader, [{ text: "Ges. Preis (€", x: 529 }]),
      line(yRow, [{ text: "1.", x: 60 }]),
      line(yRow, [{ text: "00000002738308", x: 82 }]),
      line(yRow, [{ text: "BRA Harzer ganz GRAN", x: 150 }]),
      line(yRow, [{ text: "3000", x: 371 }]),
      line(yRow, [{ text: "ST", x: 402 }]),
      line(yRow, [{ text: "1.030,00", x: 441 }]),
      line(yRow, [{ text: "12%", x: 486 }]),
      line(yRow, [{ text: "2.719,20", x: 529 }]),
      line(yDesc, [{ text: "Star Matt granit", x: 150 }]),
      line(yDesc + 1, [{ text: "(/1000)", x: 448 }]),
      line(yDisc, [{ text: "906,40", x: 449 }]),
      line(yRow + 35, [{ text: "2.", x: 60 }]),
      line(yRow + 35, [{ text: "D9304", x: 82 }]),
      line(yRow + 35, [{ text: "Euro 2 - Palette", x: 150 }]),
      line(yRow + 35, [{ text: "14", x: 381 }]),
      line(yRow + 35, [{ text: "St", x: 404 }]),
      line(yRow + 35, [{ text: "19,00", x: 454 }]),
      line(yRow + 35, [{ text: "266,00", x: 537 }]),
    ];

    const structured: PdfStructured = {
      sourceFileName: "koelnsperger.pdf",
      pages: [
        {
          index: 0,
          width: 595,
          height: 842,
          lines,
          rawText: "Kölnsperger Bedachungshandel GmbH\ninfo@koelnsperger-gmbh.de",
        },
      ],
    };

    const { items } = extractKoelnspergerItems(structured);
    expect(items.length).toBe(2);
    expect(items[0]?.position).toBe("1");
    expect(items[0]?.article_number).toBe("00000002738308");
    expect(items[0]?.quantity).toBe(3000);
    expect(items[0]?.line_total).toBe(2719.2);
    expect(items[0]?.description).toContain("Star Matt granit");
    expect(items[0]?.unit_price).toBe(906.4);
    expect(items[0]?.price_per).toBe(1000);
    expect(items[1]?.article_number).toBe("D9304");
    expect(items[1]?.line_total).toBe(266);
  });

  it("parses freight multiplier (*0,001)", () => {
    const yHeader = 487;
    const yRow = 696;
    const lines: PdfLine[] = [
      line(yHeader, [{ text: "Pos.", x: 60 }]),
      line(yHeader, [{ text: "Art-Nr.", x: 82 }]),
      line(yHeader, [{ text: "Artikel Bezeichnung", x: 150 }]),
      line(yHeader, [{ text: "Mge.", x: 371 }]),
      line(yHeader, [{ text: "Einh.", x: 402 }]),
      line(yHeader, [{ text: "E-Preis (€)", x: 441 }]),
      line(yHeader, [{ text: "Ges. Preis (€", x: 529 }]),
      line(yRow, [{ text: "9.", x: 60 }]),
      line(yRow, [{ text: "D9203", x: 82 }]),
      line(yRow, [{ text: "Fracht inkl. Entladung ebenerdig", x: 150 }]),
      line(yRow, [{ text: "3167", x: 371 }]),
      line(yRow, [{ text: "‰ST", x: 398 }]),
      line(yRow, [{ text: "180,00", x: 448 }]),
      line(yRow, [{ text: "570,06", x: 537 }]),
      line(yRow + 11, [{ text: "(*0,001)", x: 444 }]),
    ];
    const structured: PdfStructured = {
      sourceFileName: "koelnsperger.pdf",
      pages: [
        {
          index: 0,
          width: 595,
          height: 842,
          lines,
          rawText: "Kölnsperger Bedachungshandel GmbH",
        },
      ],
    };
    const { items } = extractKoelnspergerItems(structured);
    expect(items.length).toBe(1);
    expect(items[0]?.quantity).toBe(3167);
    expect(items[0]?.unit_price).toBe(180);
    expect(items[0]?.line_total).toBe(570.06);
    expect(items[0]?.price_per).toBe(0.001);
  });

  it("extracts small single-digit quantities", () => {
    const yHeader = 487;
    const yRow = 609;
    const lines: PdfLine[] = [
      line(yHeader, [{ text: "Pos.", x: 60 }]),
      line(yHeader, [{ text: "Art-Nr.", x: 82 }]),
      line(yHeader, [{ text: "Artikel Bezeichnung", x: 150 }]),
      line(yHeader, [{ text: "Mge.", x: 371 }]),
      line(yHeader, [{ text: "Einh.", x: 402 }]),
      line(yHeader, [{ text: "E-Preis (€)", x: 441 }]),
      line(yHeader, [{ text: "Ges. Preis (€", x: 529 }]),
      line(yRow, [{ text: "5.", x: 60 }]),
      line(yRow, [{ text: "00000002734148", x: 82 }]),
      line(yRow, [{ text: "BRA Firstendstein m.Kl. GRAN", x: 150 }]),
      line(yRow, [{ text: "2", x: 386 }]),
      line(yRow, [{ text: "ST", x: 402 }]),
      line(yRow, [{ text: "14,45", x: 453 }]),
      line(yRow, [{ text: "25,43", x: 541 }]),
      line(yRow + 11, [{ text: "12,72", x: 453 }]),
    ];
    const structured: PdfStructured = {
      sourceFileName: "koelnsperger.pdf",
      pages: [
        {
          index: 0,
          width: 595,
          height: 842,
          lines,
          rawText: "Kölnsperger Bedachungshandel GmbH",
        },
      ],
    };
    const { items } = extractKoelnspergerItems(structured);
    expect(items[0]?.quantity).toBe(2);
    expect(items[0]?.unit_price).toBe(12.72);
    expect(items[0]?.line_total).toBe(25.43);
  });

  it("does not pull prior multi-line description into the next position", () => {
    // Geometry from AN2026-0981: continuations ~13pt above next pos must stay on pos 1.
    const yHeader = 403;
    const lines: PdfLine[] = [
      line(yHeader, [{ text: "Pos.", x: 60 }]),
      line(yHeader, [{ text: "Art-Nr.", x: 82 }]),
      line(yHeader, [{ text: "Artikel Bezeichnung", x: 150 }]),
      line(yHeader, [{ text: "Mge.", x: 371 }]),
      line(yHeader, [{ text: "Einh.", x: 402 }]),
      line(yHeader, [{ text: "E-Preis (€)", x: 441 }]),
      line(yHeader, [{ text: "Ges. Preis (€", x: 529 }]),
      line(416, [{ text: "1.", x: 60 }]),
      line(416, [{ text: "00000001097823", x: 82 }]),
      line(416, [{ text: "NAH Holzf.Flex 220mm stumpf 038", x: 150 }]),
      line(416, [{ text: "182,39", x: 364 }]),
      line(416, [{ text: "m²", x: 403 }]),
      line(416, [{ text: "14,74", x: 454 }]),
      line(416, [{ text: "2.688,43", x: 529 }]),
      line(426, [{ text: "1220x 575mm Holzfaserdpl.", x: 150 }]),
      line(436, [{ text: "14,03m² / Pal", x: 150 }]),
      line(446, [{ text: "= 13 Pal.", x: 150 }]),
      line(459, [{ text: "2.", x: 60 }]),
      line(459, [{ text: "00000001097819", x: 82 }]),
      line(459, [{ text: "NAH Holzf.Flex 40mm stumpf 038", x: 150 }]),
      line(459, [{ text: "159,98", x: 364 }]),
      line(459, [{ text: "m²", x: 403 }]),
      line(459, [{ text: "2,68", x: 459 }]),
      line(459, [{ text: "428,75", x: 537 }]),
      line(469, [{ text: "1220x 575mm Holzfaserdpl.", x: 150 }]),
      line(479, [{ text: "84,18m² / Pal", x: 150 }]),
      line(489, [{ text: "19 Pakete", x: 150 }]),
    ];
    const structured: PdfStructured = {
      sourceFileName: "koelnsperger.pdf",
      pages: [
        {
          index: 0,
          width: 595,
          height: 842,
          lines,
          rawText: "Kölnsperger Bedachungshandel GmbH\ninfo@koelnsperger-gmbh.de",
        },
      ],
    };
    const { items } = extractKoelnspergerItems(structured);
    expect(items.length).toBe(2);
    expect(items[0]?.description).toContain("= 13 Pal.");
    expect(items[0]?.description).toContain("14,03m² / Pal");
    expect(items[1]?.description).not.toContain("= 13 Pal.");
    expect(items[1]?.description).not.toContain("14,03m² / Pal");
    expect(items[1]?.description).toContain("NAH Holzf.Flex 40mm stumpf 038");
    expect(items[1]?.description).toContain("19 Pakete");
  });

  it("keeps MuPDF preamble description that hugs the next position row", () => {
    // Pos 6 geometry: title 1pt above the position anchor.
    const yHeader = 403;
    const lines: PdfLine[] = [
      line(yHeader, [{ text: "Pos.", x: 60 }]),
      line(yHeader, [{ text: "Art-Nr.", x: 82 }]),
      line(yHeader, [{ text: "Artikel Bezeichnung", x: 150 }]),
      line(yHeader, [{ text: "Mge.", x: 371 }]),
      line(yHeader, [{ text: "Einh.", x: 402 }]),
      line(yHeader, [{ text: "E-Preis (€)", x: 441 }]),
      line(yHeader, [{ text: "Ges. Preis (€", x: 529 }]),
      line(539, [{ text: "5.", x: 60 }]),
      line(539, [{ text: "00000001760518", x: 82 }]),
      line(539, [{ text: "ALJ Allfix 310ml", x: 150 }]),
      line(539, [{ text: "12", x: 381 }]),
      line(539, [{ text: "ST", x: 402 }]),
      line(539, [{ text: "8,36", x: 459 }]),
      line(539, [{ text: "100,32", x: 537 }]),
      line(549, [{ text: "Kartusche", x: 150 }]),
      line(561, [{ text: "Logistikpauschale ab 7,49 t LKW", x: 150 }]),
      line(562, [{ text: "6.", x: 60 }]),
      line(562, [{ text: "L-0002", x: 82 }]),
      line(562, [{ text: "1", x: 386 }]),
      line(562, [{ text: "ST", x: 402 }]),
      line(562, [{ text: "55,00", x: 454 }]),
      line(562, [{ text: "55,00", x: 542 }]),
    ];
    const structured: PdfStructured = {
      sourceFileName: "koelnsperger.pdf",
      pages: [
        {
          index: 0,
          width: 595,
          height: 842,
          lines,
          rawText: "Kölnsperger Bedachungshandel GmbH\ninfo@koelnsperger-gmbh.de",
        },
      ],
    };
    const { items } = extractKoelnspergerItems(structured);
    expect(items.length).toBe(2);
    expect(items[1]?.article_number).toBe("L-0002");
    expect(items[1]?.description).toContain("Logistikpauschale ab 7,49 t LKW");
    expect(items[0]?.description).toContain("Kartusche");
    expect(items[0]?.description).not.toContain("Logistikpauschale");
  });

  it("anchors free-form article codes (MT/AP/BM) via row signal", () => {
    const yHeader = 436;
    const lines: PdfLine[] = [
      line(yHeader, [{ text: "Pos.", x: 60 }]),
      line(yHeader, [{ text: "Art-Nr.", x: 82 }]),
      line(yHeader, [{ text: "Artikel Bezeichnung", x: 150 }]),
      line(yHeader, [{ text: "Mge.", x: 371 }]),
      line(yHeader, [{ text: "Einh.", x: 402 }]),
      line(yHeader, [{ text: "E-Preis (€)", x: 441 }]),
      line(yHeader, [{ text: "Ges. Preis (€", x: 529 }]),
      line(449, [{ text: "1.", x: 60 }]),
      line(449, [{ text: "MT110-100ST-1.5", x: 82 }]),
      line(449, [{ text: "best wood MULTITHERM 110-100 stumpf", x: 150 }]),
      line(449, [{ text: "180", x: 376 }]),
      line(449, [{ text: "m²", x: 403 }]),
      line(449, [{ text: "10,80", x: 454 }]),
      line(449, [{ text: "1.944,00", x: 529 }]),
      line(492, [{ text: "2.", x: 60 }]),
      line(492, [{ text: "AP", x: 82 }]),
      line(492, [{ text: "Anbruchpalette", x: 150 }]),
      line(492, [{ text: "1", x: 386 }]),
      line(492, [{ text: "ST", x: 402 }]),
      line(492, [{ text: "25,00", x: 454 }]),
      line(492, [{ text: "25,00", x: 542 }]),
      line(506, [{ text: "3.", x: 60 }]),
      line(506, [{ text: "00000002747125", x: 82 }]),
      line(506, [{ text: "VEL GXU CK04", x: 150 }]),
      line(506, [{ text: "2", x: 386 }]),
      line(506, [{ text: "ST", x: 402 }]),
      line(506, [{ text: "706,00", x: 449 }]),
      line(506, [{ text: "1.002,52", x: 529 }]),
    ];
    const structured: PdfStructured = {
      sourceFileName: "koelnsperger.pdf",
      pages: [
        {
          index: 0,
          width: 595,
          height: 842,
          lines,
          rawText: "Kölnsperger Bedachungshandel GmbH\ninfo@koelnsperger-gmbh.de",
        },
      ],
    };
    const { items } = extractKoelnspergerItems(structured);
    expect(items.map((i) => i.article_number)).toEqual([
      "MT110-100ST-1.5",
      "AP",
      "00000002747125",
    ]);
    expect(items[0]?.position).toBe("1");
    expect(items[0]?.quantity).toBe(180);
    expect(items[1]?.description).toContain("Anbruchpalette");
  });
});

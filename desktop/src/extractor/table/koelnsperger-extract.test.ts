import { describe, expect, it } from "vitest";
import type { PdfLine, PdfStructured } from "../../pdf/types";
import { extractKoelnspergerItems } from "./koelnsperger-extract";
import { KOELNSPERGER_POSITION_RE, looksLikeKoelnspergerArticle } from "./koelnsperger-anchors";

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
});

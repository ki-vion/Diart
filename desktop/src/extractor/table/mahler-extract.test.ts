import { describe, expect, it } from "vitest";
import type { PdfLine, PdfStructured } from "../../pdf/types";
import { cleanMahlerDescription, extractMahlerItems, isMahlerProfilItem, isMahlerSkipDescriptionLine } from "./mahler-extract";
import { MAHLER_POSITION_RE } from "./mahler-anchors";

function line(y: number, parts: Array<{ text: string; x: number }>): PdfLine {
  const words = parts.map((p) => ({ ...p, y, fontSize: 10 }));
  return { y, words, text: words.map((w) => w.text).join(" ") };
}

describe("MAHLER_POSITION_RE", () => {
  it("accepts Mahler positions and rejects PLZ", () => {
    expect(MAHLER_POSITION_RE.test("1,0")).toBe(true);
    expect(MAHLER_POSITION_RE.test("12,0")).toBe(true);
    expect(MAHLER_POSITION_RE.test("86159")).toBe(false);
  });
});

describe("cleanMahlerDescription", () => {
  it("removes pickup lines and page imprint fragments", () => {
    const raw = [
      "Dano Bauplatte GKB 12,5 mm",
      "Abholung vom Lager",
      "12,5 x 1250 x 2000 mm",
      "GmbH",
      "86159 Augsburg",
    ].join("\n");
    expect(cleanMahlerDescription(raw)).toBe(
      "Dano Bauplatte GKB 12,5 mm\n12,5 x 1250 x 2000 mm",
    );
    expect(isMahlerSkipDescriptionLine("Kommission Abholung")).toBe(true);
  });
});

describe("isMahlerProfilItem", () => {
  it("matches profile descriptions case-insensitively", () => {
    expect(isMahlerProfilItem("C-Wandprofil 75/50/0,6 mm")).toBe(true);
    expect(isMahlerProfilItem("U-Aussteifungsprofil 98/40/2 mm")).toBe(true);
    expect(isMahlerProfilItem("Dano Bauplatte GKB 12,5 mm")).toBe(false);
  });
});

describe("extractMahlerItems", () => {
  it("extracts split rows with clean descriptions", () => {
    const yHeader = 405;
    const yRow = 436;
    const yPrice = 438;
    const lines: PdfLine[] = [
      line(yHeader, [{ text: "Pos", x: 62 }]),
      line(yHeader, [{ text: "Art.-Nr.", x: 102 }]),
      line(yHeader, [{ text: "Bezeichnung", x: 138 }]),
      line(yHeader, [{ text: "Menge", x: 396 }]),
      line(yHeader, [{ text: "Einzelpreis", x: 456 }]),
      line(yHeader, [{ text: "Gesamtpreis", x: 526 }]),
      line(yRow, [{ text: "1,0", x: 66 }]),
      line(yRow, [{ text: "252494", x: 108 }]),
      line(yRow, [{ text: "Dano Bauplatte GKB 12,5 mm", x: 141 }]),
      line(yRow, [{ text: "1.200,000", x: 367 }]),
      line(yRow, [{ text: "M2", x: 415 }]),
      line(yPrice, [{ text: "2,82", x: 489 }]),
      line(yPrice, [{ text: "3.384,00 EUR", x: 524 }]),
      line(444, [{ text: "Abholung vom Lager", x: 141 }]),
      line(460, [{ text: "86159", x: 66 }]),
      line(460, [{ text: "Augsburg", x: 108 }]),
      line(470, [{ text: "2,0", x: 66 }]),
      line(470, [{ text: "257086", x: 108 }]),
      line(470, [{ text: "C-Wandprofil 75/50/0,6 mm", x: 141 }]),
      line(470, [{ text: "400,000", x: 367 }]),
      line(470, [{ text: "M", x: 415 }]),
      line(472, [{ text: "1,28", x: 489 }]),
      line(472, [{ text: "512,00 EUR", x: 524 }]),
    ];

    const structured: PdfStructured = {
      sourceFileName: "mahler.pdf",
      pages: [{ index: 0, width: 595, height: 842, lines, rawText: "Bauwaren Mahler GmbH" }],
    };

    const { items } = extractMahlerItems(structured);
    expect(items.length).toBe(2);
    expect(items[0]?.position).toBe("1,0");
    expect(items[0]?.article_number).toBe("252494");
    expect(items[0]?.description).toContain("Dano Bauplatte");
    expect(items[0]?.description).not.toContain("Abholung vom Lager");
    expect(items[0]?.description).not.toContain("3.384,00");
    expect(items[0]?.description).not.toMatch(/^1,0/);
    expect(items[1]?.position).toBe("2,0");
    expect(items[1]?.description).toContain("C-Wandprofil");
    expect(items[1]?.line_total).toBe(5.12);
    expect(items[1]?.price_per).toBe(100);
    expect(items[0]?.price_per).toBeUndefined();
    expect(items.some((i) => i.position === "86159")).toBe(false);
  });
});

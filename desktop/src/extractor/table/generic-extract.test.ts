import { describe, expect, it } from "vitest";
import type { PdfLine } from "../../pdf/types";
import { extractGenericTableItems } from "./generic-extract";
import { findTableRegion } from "./table-region";
import { isGenericPositionAnchor } from "./generic-anchors";

function line(y: number, parts: Array<{ text: string; x: number }>): PdfLine {
  const words = parts.map((p) => ({ ...p, y, fontSize: 10 }));
  return { y, words, text: words.map((w) => w.text).join(" ") };
}

describe("generic position anchors", () => {
  it("matches 1–8 digit positions with optional decimal", () => {
    const region = {
      boundaries: [39, 95, 130, 380, 440, 510],
      columnMap: { position: 0, article: 1, description: 2, quantity: 3, unitPrice: 4, lineTotal: 5 },
    };
    expect(isGenericPositionAnchor(line(436, [{ text: "1,0", x: 66 }]), region)).toBe(true);
    expect(isGenericPositionAnchor(line(436, [{ text: "11454178", x: 464 }]), region)).toBe(false);
  });
});

describe("extractGenericTableItems", () => {
  it("extracts Mahler-style split rows after header", () => {
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
      line(460, [{ text: "2,0", x: 66 }]),
      line(460, [{ text: "257086", x: 108 }]),
      line(460, [{ text: "C-Wandprofil 75/50/0,6 mm", x: 141 }]),
      line(460, [{ text: "400,000", x: 367 }]),
      line(460, [{ text: "M", x: 415 }]),
      line(462, [{ text: "1,28", x: 489 }]),
      line(462, [{ text: "512,00 EUR", x: 524 }]),
    ];

    const page = { index: 0, width: 595, height: 842, lines, rawText: "" };
    const region = findTableRegion(page);
    expect(region).not.toBeNull();

    const items = extractGenericTableItems(page, region!);
    expect(items.length).toBe(2);
    expect(items[0]?.position).toBe("1,0");
    expect(items[0]?.article_number).toBe("252494");
    expect(items[0]?.quantity).toBe(1200);
    expect(items[0]?.unit).toBe("M2");
    expect(items[0]?.unit_price).toBe(2.82);
    expect(items[0]?.line_total).toBe(3384);
    expect(items[0]?.description).toContain("Dano Bauplatte");
    expect(items[0]?.description).toContain("Abholung vom Lager");
    expect(items[1]?.position).toBe("2,0");
    expect(items[1]?.article_number).toBe("257086");
  });
});

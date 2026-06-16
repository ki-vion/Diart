import { describe, expect, it } from "vitest";
import type { PdfLine } from "../../pdf/types";
import { extractAnchoredItems } from "./anchor-extract";
import { findBlockAnchors } from "./item-blocks";
import { getPageTableMeta } from "./line-meta";
import { findTableRegionOrContinuation } from "./table-region";

function wl(y: number, text: string, x: number, fontSize = 10): PdfLine {
  return {
    y,
    text,
    words: [{ text, x, y, fontSize }],
  };
}

/** MuPDF splits RK invoice rows into one JSON line per column cluster (8779135547 Rechnung RK.pdf p.2). */
function rkRechnungPage2Lines(): PdfLine[] {
  const lines: PdfLine[] = [
    wl(103, "2", 76, 8),
    wl(103, "Seite 2 /", 493.75, 8),
    wl(121, "RECHNUNG", 297.75),
    wl(121, "8779135547", 439.5),
    wl(138, "Kunden-Nr.", 297.75),
    wl(138, "Rechnungs-Datum", 425.05),
    wl(150, "9402363", 297.75),
    wl(150, "12.06.2026", 425.05),
    wl(165, "_______________________________", 42.5),
    wl(181, "POS.", 42.5),
    wl(181, "ARTIKEL-NR.", 76.5),
    wl(181, "MENGE", 260.95),
    wl(181, "VK-ME", 300.45),
    wl(181, "EINZEL-PREIS", 365.4),
    wl(181, "PE", 439.35),
    wl(181, "POS.-WERT", 490.4),
    wl(193, "ARTIKELBEZEICHNUNG", 76),
    wl(193, "UMRECHNUNG", 76),
    wl(193, "UR-ME", 76),
    wl(193, "IN EUR", 76),
    wl(199, "_______________________________", 265.7),
    wl(215, "00010", 42.5),
    wl(215, "581558", 76.5),
    wl(215, "40", 300.65),
    wl(215, "ST", 314.6),
    wl(215, "GPr", 348.6),
    wl(215, "41,55", 397.35),
    wl(215, "EUR/1  M2", 430.8),
    wl(227, "Norbord Sterling OSB/3-Platte", 76.5),
    wl(227, "=67,500", 275.35),
    wl(227, "M2", 314.6),
    wl(239, "2500 x 675 x 22 mm EN 300", 76.5),
    wl(239, "8,31", 402.9),
    wl(251, "560,93", 508),
    wl(278, "00020", 42.5),
    wl(278, "204426", 76.5),
    wl(278, "20", 300.65),
    wl(278, "ST", 314.6),
    wl(278, "3,95", 402.9),
    wl(290, "Rigips GKBI Bauplatte 12,5 mm", 76.5),
    wl(290, "=62,500", 275.35),
    wl(290, "246,88", 508),
    wl(477, "Skontierfähiger", 42.5),
    wl(477, "Brutto-Warenbetrag: 847,36", 230.81),
    wl(477, "Nettowert:", 301.85),
  ];
  return lines;
}

describe("RK Rechnung 8779135547 page 2", () => {
  it("finds split pos/article anchors and table region through items", () => {
    const lines = rkRechnungPage2Lines();
    const page = { lines, height: 842 };

    const anchors = findBlockAnchors(lines, 0);
    expect(anchors.some((a) => a.lineIndex === lines.findIndex((l) => l.text === "00010"))).toBe(
      true,
    );

    const region = findTableRegionOrContinuation(page);
    expect(region).not.toBeNull();
    expect(region!.dataEndIndex).toBeGreaterThan(region!.dataStartIndex + 5);

    const meta = getPageTableMeta(page);
    expect(meta.anchors.length).toBeGreaterThan(0);
  });

  it("extracts line items from continuation page", () => {
    const lines = rkRechnungPage2Lines();
    const items = extractAnchoredItems(
      { pages: [{ index: 1, width: 595, height: 842, lines, rawText: "" }] },
      "RAAB Karcher",
    );
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]?.position).toBe("00010");
    expect(items[0]?.article_number).toBe("581558");
    expect(items[0]?.line_total).toBeCloseTo(560.93, 2);
  });
});

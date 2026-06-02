import { describe, expect, it } from "vitest";
import { extractNoritFromLines } from "./extract-norit";
import { parseNoritBlock } from "../table/norit-block";

describe("extractNoritFromLines", () => {
  it("parses real Norit field order (qty, pos, net, then details)", () => {
    const lines = [
      "Rechnungsnummer:",
      "Einzelpreis",
      "Pos",
      "Menge",
      "50 St",
      "120",
      "1.217,70 EUR",
      "TE 25 Therm GF-U 150-15",
      "27,000 m²",
      "45,10 EUR /m²",
      "00114328",
      "50 St",
      "130",
      "753,30 EUR",
      "TE 25 Therm GF-E 150-15",
      "27,000 m²",
      "27,90 EUR /m²",
      "00114339",
    ];

    const result = extractNoritFromLines(lines, "Norit Rechnung.pdf");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.position).toBe("120");
    expect(result.items[0]?.line_total).toBe(1217.7);
    expect(result.items[0]?.quantity).toBe(27);
    expect(result.items[0]?.unit_price).toBe(45.1);
    expect(result.items[1]?.position).toBe("130");
    expect(result.items[1]?.line_total).toBe(753.3);
  });

  it("merges page-spanning position 180 without next-page surcharges", () => {
    const lines = [
      "50,000 m",
      "180",
      "42,50 EUR",
      "NORIT-Randdämmstreifen",
      "aus PE-Schaum, Farbton grau",
      "mit ca. 300 mm breiter",
      "Schleppfolie",
      "0,85 EUR /m",
      "6.717,75",
      "Übertrag:",
      "EUR",
      "Rechnungsnummer:",
      "990000617142",
      "Seite: 3 von 4",
      "6.717,75",
      "Übertrag:",
      "Pos",
      "Menge",
      "Kosten f. Hubwagen/Hebebühne",
      "90,00 EUR",
      "90,00 EUR",
      "Frachtkosten, da unter 5 Tonnen,",
      "ohne Entladung",
      "250,00 EUR",
      "250,00 EUR",
      "VPE: 25 Meter/Rolle",
      "Zolltarifnr.:",
      "39191080",
      "Abmessung:",
      "80X10 MM",
      "00600550",
      "Artikelnummer:",
      "12 St",
      "190",
      "53,40 EUR",
      "Klemmringverschraubung",
    ];

    const item = parseNoritBlock(
      lines.slice(lines.indexOf("180"), lines.indexOf("190")),
      "50,000 m",
    );

    expect(item?.position).toBe("180");
    expect(item?.article_number).toBe("00600550");
    expect(item?.quantity).toBe(50);
    expect(item?.unit).toBe("m");
    expect(item?.unit_price).toBe(0.85);
    expect(item?.line_total).toBe(42.5);
    expect(item?.description).toContain("NORIT-Randdämmstreifen");
    expect(item?.description).toContain("Schleppfolie");
    expect(item?.description).toContain("VPE: 25 Meter/Rolle");
    expect(item?.description).toContain("Zolltarifnr.:");
    expect(item?.description).toContain("Artikelnummer:");
    expect(item?.description).not.toContain("Hubwagen");
    expect(item?.description).not.toContain("990000617142");
    expect(item?.description).not.toContain("12 St");
  });
});

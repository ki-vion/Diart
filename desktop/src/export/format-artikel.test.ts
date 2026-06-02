import { describe, expect, it } from "vitest";
import { formatArtikelCell, formatEinheitCell, normalizeUnits } from "./format-artikel";

describe("formatArtikelCell", () => {
  it("combines article number and description on separate lines", () => {
    expect(
      formatArtikelCell({
        article_number: "249706",
        description: "Fermacell Estrich-Wabe",
      }),
    ).toBe("249706\nFermacell Estrich-Wabe");
  });

  it("prefixes IFB/KAN article numbers with Artikelnummer:", () => {
    expect(
      formatArtikelCell(
        {
          article_number: "0206050001",
          description: "weber.prim 400 Tiefgrund\n10l/Eimer",
        },
        { layoutId: "IFB GmbH" },
      ),
    ).toBe("Artikelnummer: 0206050001\nweber.prim 400 Tiefgrund\n10l/Eimer");
  });

  it("keeps IFB alternative intro in artikel_prefix before Artikelnummer:", () => {
    expect(
      formatArtikelCell(
        {
          artikel_prefix: "Als Alternative schlagen wir\nfolgenden Artikel vor:",
          article_number: "0206050001",
          description: "weber.star 224 AquaBalance K2\nweiß, 25/Sack, Basis",
        },
        { layoutId: "IFB GmbH" },
      ),
    ).toBe(
      "Als Alternative schlagen wir\nfolgenden Artikel vor:\nArtikelnummer: 0206050001\nweber.star 224 AquaBalance K2\nweiß, 25/Sack, Basis",
    );
  });

  it("returns description only when no article number", () => {
    expect(
      formatArtikelCell({
        article_number: null,
        description: "Nur Text",
      }),
    ).toBe("Nur Text");
  });

  it("does not duplicate article number if already in description", () => {
    expect(
      formatArtikelCell({
        article_number: "249706",
        description: "Art. 249706 Fermacell",
      }),
    ).toBe("Art. 249706 Fermacell");
  });

  it("puts artikel_prefix before article number with line breaks", () => {
    expect(
      formatArtikelCell({
        artikel_prefix: "Alternativposition zu Position 0010",
        article_number: "9800928",
        description: "Zaunpfahl HADRA\n48x2,0x2300 mm",
      }),
    ).toBe(
      "Alternativposition zu Position 0010\n9800928\nZaunpfahl HADRA\n48x2,0x2300 mm",
    );
  });

  it("joins m + newline + ² into m²", () => {
    expect(
      formatArtikelCell({
        article_number: "55521230",
        description: "3 Rolle(n) (à 55 m\n²)",
      }),
    ).toBe("55521230\n3 Rolle(n) (à 55 m²)");
  });

  it("joins m + newline + ³ into m³", () => {
    expect(
      formatArtikelCell({
        article_number: "X",
        description: "1 Palette (à 2 m\n³)",
      }),
    ).toBe("X\n1 Palette (à 2 m³)");
  });

  it("does not join bare m and ² on separate lines without a dimension", () => {
    expect(normalizeUnits("Zeile mit m\n²\nanderer Text")).toBe(
      "Zeile mit m\nanderer Text",
    );
  });

  it("shows article id and (Alternativposition) on one line", () => {
    expect(
      formatArtikelCell({
        article_number: "55501726",
        description: "(Alternativposition)\nAnputzleiste mit Gewebe",
      }),
    ).toBe("55501726 (Alternativposition)\nAnputzleiste mit Gewebe");
  });

  it("keeps 1,10m width and only joins packaging m² (Laier VWS-Gewebe)", () => {
    expect(
      formatArtikelCell({
        article_number: "55521230",
        description: "VWS-Gewebe 165gr weiß 1,10m\n²\n3 Rolle(n) (à 55 m\n²)",
      }),
    ).toBe(
      "55521230\nVWS-Gewebe 165gr weiß 1,10m\n3 Rolle(n) (à 55 m²)",
    );
  });
});

describe("formatEinheitCell", () => {
  it("maps Einheit m to m² from packaging line, not from 1,10m width", () => {
    expect(
      formatEinheitCell("m", "VWS-Gewebe 165gr weiß 1,10m\n3 Rolle(n) (à 55 m²)"),
    ).toBe("m²");
    expect(formatEinheitCell("m", "VWS-Gewebe 165gr weiß 1,10m\n²")).toBe("m");
  });

  it("keeps linear meter unit when no m² in description", () => {
    expect(formatEinheitCell("m", "Kabel 5,0 m Laufmeter")).toBe("m");
  });
});

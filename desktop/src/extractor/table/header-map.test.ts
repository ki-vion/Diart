import { describe, expect, it } from "vitest";
import { mapColumnsFromHeaderCells } from "./header-map";

describe("mapColumnsFromHeaderCells", () => {
  it("maps Mahler header cells without confusing Menge and ME", () => {
    const map = mapColumnsFromHeaderCells([
      "Pos",
      "Art.-Nr.",
      "Bezeichnung",
      "Menge",
      "Einzelpreis",
      "Gesamtpreis",
    ]);
    expect(map.position).toBe(0);
    expect(map.article).toBe(1);
    expect(map.quantity).toBe(3);
    expect(map.unit).toBeUndefined();
  });

  it("maps Artikel to article not position", () => {
    expect(mapColumnsFromHeaderCells(["Artikel"])).toEqual({ article: 0 });
  });

  it("maps Laier header cells", () => {
    const map = mapColumnsFromHeaderCells([
      "Artikel",
      "Menge",
      "Einheit",
      "VK-Preis",
      "Betrag",
    ]);
    expect(map.article).toBe(0);
    expect(map.quantity).toBe(1);
    expect(map.unit).toBe(2);
    expect(map.unitPrice).toBe(3);
    expect(map.lineTotal).toBe(4);
  });
});

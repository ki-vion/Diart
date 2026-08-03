import { describe, expect, it } from "vitest";
import { detectProfile } from "./detect-profile";
import type { PdfStructured } from "../../pdf/types";

function structured(page0: string): PdfStructured {
  return { pages: [{ index: 0, width: 0, height: 0, lines: [], rawText: page0 }] };
}

describe("detectProfile", () => {
  it("detects known suppliers", () => {
    expect(detectProfile(structured("ANGEBOT\nKAN"))).toBe("IFB GmbH");
    expect(detectProfile(structured("Rechnungsnummer:\nEinzelpreis"))).toBe(
      "Norit",
    );
    expect(detectProfile(structured("STARK Deutschland"))).toBe("RAAB Karcher");
    expect(detectProfile(structured("Rudolf Laier GmbH\nVAN029183"))).toBe(
      "Rudolf Laier GmbH",
    );
    expect(detectProfile(structured("Bauwaren Mahler GmbH\nwww.mahler.de"))).toBe(
      "Bauwaren Mahler",
    );
    expect(detectProfile(structured("unknown"))).toBe("generic");
  });

  it("detects Econ Floor / FPF proforma invoices", () => {
    expect(detectProfile(structured("Proforma Invoice\nFPF/2026/234"))).toBe("econ floor");
    expect(detectProfile(structured("ECONFLOOR\nDocument Number"))).toBe("econ floor");
    expect(detectProfile(structured("econ floor polska"))).toBe("econ floor");
    expect(detectProfile(structured("Document FPF/2026/234"))).toBe("econ floor");
  });
});

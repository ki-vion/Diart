import { describe, expect, it } from "vitest";
import { detectProfile } from "./detect-profile";
import type { PdfStructured } from "../../pdf/types";

function structured(page0: string): PdfStructured {
  return { pages: [{ index: 0, width: 0, height: 0, lines: [], rawText: page0 }] };
}

describe("detectProfile", () => {
  it("detects known suppliers", () => {
    expect(detectProfile(structured("ANGEBOT\nKAN"))).toBe("kan_ifb");
    expect(detectProfile(structured("Rechnungsnummer:\nEinzelpreis"))).toBe(
      "norit_rechnung",
    );
    expect(detectProfile(structured("STARK Deutschland"))).toBe("rk_stark");
    expect(detectProfile(structured("VK-Preis\nVAN0123"))).toBe("laier_van");
    expect(detectProfile(structured("unknown"))).toBe("generic");
  });
});

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
    expect(
      detectProfile(
        structured("Kölnsperger Bedachungshandel GmbH\ninfo@koelnsperger-gmbh.de"),
      ),
    ).toBe("Kölnsperger");
    expect(
      detectProfile(
        structured("ECONFLOOR POLSKA\noffice@econfloorpolska.com\nCommercial Offer"),
      ),
    ).toBe("econ floor");
    expect(detectProfile(structured("unknown"))).toBe("generic");
  });
});

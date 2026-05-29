import { describe, expect, it } from "vitest";
import type { PdfLine } from "../../pdf/types";
import { isRkAfterTableText, isRkFooterLine, isRkNonItemText } from "./rk-footer";

function line(y: number, text: string, x: number, fontSize: number): PdfLine {
  return {
    y,
    text,
    words: [{ text, x, y, fontSize }],
  };
}

describe("isRkNonItemText", () => {
  it("detects legal imprint lines", () => {
    expect(isRkNonItemText("Raab Karcher - eine Marke der STARK Deutschland GmbH")).toBe(
      true,
    );
    expect(isRkNonItemText("9402363 03.02.2026")).toBe(true);
  });

  it("allows product description", () => {
    expect(isRkNonItemText("RAW Betonestrich fein")).toBe(false);
    expect(isRkNonItemText("Körn. 4 mm 30 kg/Sa")).toBe(false);
    expect(isRkNonItemText("Alternativposition zu Position 0010")).toBe(false);
  });
});

describe("isRkAfterTableText", () => {
  it("detects summary and terms after the table", () => {
    expect(isRkAfterTableText("GewichtBrutto 400,054KG Nettowert: 2.859,50")).toBe(true);
    expect(isRkAfterTableText("Zahlungsbedingungen: 19,00% MwSt.")).toBe(true);
    expect(isRkAfterTableText("______________________________________________________________________")).toBe(
      true,
    );
    expect(isRkAfterTableText("MitfreundlichenGrüßen,")).toBe(true);
  });
});

describe("isRkFooterLine", () => {
  const pageHeight = 842;

  it("detects bottom small-type centered footer", () => {
    expect(
      isRkFooterLine(
        line(775, "RaabKarcher-eineMarkederSTARKDeutschlandGmbH", 222, 6),
        pageHeight,
      ),
    ).toBe(true);
  });

  it("keeps table description lines", () => {
    expect(isRkFooterLine(line(645, "Körn.4mm30kg/Sa", 76, 9.96), pageHeight)).toBe(
      false,
    );
  });
});

import { describe, expect, it } from "vitest";
import { parseRkBlock } from "./extract-rk";

describe("parseRkBlock", () => {
  it("parses multi-line STARK/Raab Karcher position block", () => {
    const item = parseRkBlock([
      "00010 249706",
      "<B>",
      "Fermacell Estrich-Wabe",
      "105",
      "= 70",
      "M2",
      "ST",
      "13,38",
      "EUR/1 M2",
      "1.404,90",
    ]);

    expect(item?.position).toBe("00010");
    expect(item?.article_number).toBe("249706");
    expect(item?.quantity).toBe(105);
    expect(item?.unit_price).toBe(13.38);
    expect(item?.line_total).toBe(1404.9);
    expect(item?.description).toContain("Fermacell");
  });
});

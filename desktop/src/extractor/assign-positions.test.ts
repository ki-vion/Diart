import { describe, expect, it } from "vitest";
import { assignSequentialPositions } from "./assign-positions";
import type { LineItem } from "./models";

const base: LineItem = {
  position: null,
  article_number: "1",
  artikel_prefix: null,
  description: "x",
  quantity: 1,
  unit: "Stk",
  unit_price: 1,
  line_total: 1,
};

describe("assignSequentialPositions", () => {
  it("fills empty positions with 1, 2, 3", () => {
    const out = assignSequentialPositions([
      { ...base, position: null },
      { ...base, position: null },
    ]);
    expect(out[0]?.position).toBe("1");
    expect(out[1]?.position).toBe("2");
  });

  it("keeps existing positions", () => {
    const out = assignSequentialPositions([{ ...base, position: "00010" }]);
    expect(out[0]?.position).toBe("00010");
  });
});

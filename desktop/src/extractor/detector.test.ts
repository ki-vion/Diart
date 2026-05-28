import { describe, expect, it } from "vitest";
import { detectStrategy, STRATEGIES } from "./detector";

describe("detectStrategy", () => {
  it("exposes strategy list", () => {
    expect(STRATEGIES.map((s) => s.layout_id)).toEqual([
      "kan_ifb",
      "norit_rechnung",
      "rk_stark",
      "laier_van",
    ]);
  });

  it("detects KAN IFB", () => {
    expect(detectStrategy("ANGEBOT\nBeleg\nKAN").layout_id).toBe("kan_ifb");
  });

  it("throws LAYOUT_UNKNOWN when no match", () => {
    expect(() => detectStrategy("totally unknown supplier")).toThrowError(new Error("LAYOUT_UNKNOWN"));
  });
});


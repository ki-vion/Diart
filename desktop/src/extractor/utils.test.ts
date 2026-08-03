import { describe, expect, it } from "vitest";
import { parseDeNumber } from "./utils";

describe("parseDeNumber", () => {
  it("parses German decimals", () => {
    expect(parseDeNumber("12,34")).toBeCloseTo(12.34);
  });

  it("parses thousands separators", () => {
    expect(parseDeNumber("1.234,50")).toBeCloseTo(1234.5);
  });

  it("parses space as thousands separator", () => {
    expect(parseDeNumber("2 225,27")).toBeCloseTo(2225.27);
  });

  it("returns null for empty", () => {
    expect(parseDeNumber("")).toBeNull();
    expect(parseDeNumber("   ")).toBeNull();
  });
});


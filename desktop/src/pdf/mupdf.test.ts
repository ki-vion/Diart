import { describe, expect, it } from "vitest";
import { extractPdfLines } from "./mupdf";

describe("extractPdfLines", () => {
  it("is exported as a function", () => {
    expect(typeof extractPdfLines).toBe("function");
  });
});


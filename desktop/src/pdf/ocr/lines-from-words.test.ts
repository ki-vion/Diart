import { describe, expect, it } from "vitest";
import { linesFromPdfWords, pdfWordsFromOcrBoxes } from "./lines-from-words";

describe("pdfWordsFromOcrBoxes", () => {
  it("maps pixel boxes into PDF points using scale", () => {
    const words = pdfWordsFromOcrBoxes(
      [{ text: "Hello", x0: 100, y0: 40, x1: 180, y1: 60 }],
      { pageIndex: 0, widthPt: 595, heightPt: 842, scale: 2 },
    );
    expect(words).toHaveLength(1);
    expect(words[0]!.text).toBe("Hello");
    expect(words[0]!.x).toBeCloseTo(50);
    expect(words[0]!.y).toBeCloseTo(20);
    expect(words[0]!.fontSize).toBeCloseTo(10);
  });
});

describe("linesFromPdfWords", () => {
  it("clusters words with similar y into one line left-to-right", () => {
    const lines = linesFromPdfWords([
      { text: "B", x: 80, y: 100.5, fontSize: 10 },
      { text: "A", x: 10, y: 100, fontSize: 10 },
      { text: "C", x: 10, y: 140, fontSize: 10 },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]!.text).toBe("A B");
    expect(lines[1]!.text).toBe("C");
  });
});

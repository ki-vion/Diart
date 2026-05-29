import { describe, expect, it } from "vitest";
import { groupWordsIntoLines, mergeCharsIntoWords } from "./table-words";

describe("mergeCharsIntoWords", () => {
  it("merges adjacent characters on the same line", () => {
    const words = mergeCharsIntoWords([
      { text: "2", x: 200, y: 100, fontSize: 10 },
      { text: ",", x: 206, y: 100, fontSize: 10 },
      { text: "0", x: 210, y: 100, fontSize: 10 },
      { text: "0", x: 216, y: 100, fontSize: 10 },
    ]);
    expect(words).toHaveLength(1);
    expect(words[0]?.text).toBe("2,00");
  });
});

describe("groupWordsIntoLines", () => {
  it("groups words with similar y into one line sorted by x", () => {
    const lines = groupWordsIntoLines(
      [
        { text: "20,00", x: 400, y: 100.2, fontSize: 10 },
        { text: "2,00", x: 200, y: 100.0, fontSize: 10 },
        { text: "Stk", x: 250, y: 99.8, fontSize: 10 },
      ],
      3,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toBe("2,00 Stk 20,00");
  });

  it("splits words on different y bands into separate lines", () => {
    const lines = groupWordsIntoLines(
      [
        { text: "001", x: 50, y: 50, fontSize: 10 },
        { text: "ABC", x: 100, y: 80, fontSize: 10 },
      ],
      3,
    );
    expect(lines).toHaveLength(2);
  });
});

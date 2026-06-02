import { describe, expect, it } from "vitest";
import { wordsFromLineText } from "./structured-lines";

describe("wordsFromLineText", () => {
  it("splits JSON line text into words with x from character positions", () => {
    const chars = "DoppelstabmatteschwereAusführung".split("").map((text, i) => ({
      text,
      x: 76.56 + i * 5.5,
      y: 248.52,
      fontSize: 9.96,
    }));

    const words = wordsFromLineText("Doppelstabmatte schwere Ausführung", chars, 9.96);

    expect(words.map((w) => w.text)).toEqual([
      "Doppelstabmatte",
      "schwere",
      "Ausführung",
    ]);
    expect(words[0]!.x).toBeCloseTo(76.56, 0);
    expect(words[1]!.x).toBeGreaterThan(words[0]!.x);
    expect(words[2]!.x).toBeGreaterThan(words[1]!.x);
  });
});

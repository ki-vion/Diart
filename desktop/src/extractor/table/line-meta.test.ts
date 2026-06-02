import { describe, expect, it } from "vitest";
import { exploreLineFlags, getPageTableMeta } from "./line-meta";

function word(text: string, x: number, y: number) {
  return { text, x, y, fontSize: 10 };
}

function line(y: number, words: ReturnType<typeof word>[]) {
  return { y, words, text: words.map((w) => w.text).join(" ") };
}

describe("exploreLineFlags", () => {
  it("does not mark RK footer imprint as anchor", () => {
    const page = {
      index: 1,
      width: 595,
      height: 842,
      rawText: "",
      lines: [
        line(210, [
          word("POS.", 42, 210),
          word("ARTIKEL-NR.", 80, 210),
          word("MENGE", 300, 210),
        ]),
        line(222, [word("ARTIKELBEZEICHNUNG", 76, 222)]),
        line(236, [word("00010", 42, 236), word("9802917", 76, 236)]),
        line(782, [
          word("Hafeninsel", 156, 782),
          word("9", 156, 782),
          word("63067", 220, 782),
          word("Offenbach", 250, 782),
        ]),
      ],
    };

    const meta = getPageTableMeta(page);
    const itemFlags = exploreLineFlags(page, 2, meta);
    const footerFlags = exploreLineFlags(page, 3, meta);

    expect(itemFlags.isAnchor).toBe(true);
    expect(itemFlags.anchorKind).toBe("rk");
    expect(footerFlags.isAnchor).toBe(false);
    expect(footerFlags.isNonItem).toBe(true);
  });
});

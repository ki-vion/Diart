import { describe, expect, it } from "vitest";
import type { PdfStructured } from "../../pdf/types";
import { extractWithTemplate } from "./extract";
import { RK_STARK_TEMPLATE } from "./templates";

function word(text: string, x: number, y: number) {
  return { text, x, y, fontSize: 10 };
}

function line(y: number, words: ReturnType<typeof word>[]) {
  return { y, words, text: words.map((w) => w.text).join(" ") };
}

describe("extractWithTemplate (RK)", () => {
  it("appends multi-line description to one position", () => {
    const structured: PdfStructured = {
      pages: [
        {
          index: 1,
          width: 595,
          height: 842,
          rawText: "",
          lines: [
            line(200, [word("POS.", 45, 200), word("MENGE", 310, 200)]),
            line(236, [
              word("00010", 45, 236),
              word("249706", 100, 236),
            ]),
            line(248, [word("Fermacell", 80, 248), word("Wabe", 130, 248)]),
            line(260, [word("1500x1000x30", 80, 260), word("mm", 150, 260)]),
            line(272, [word("Überlappend", 80, 272)]),
            line(284, [word("105", 310, 284)]),
            line(296, [word("13,38", 395, 296)]),
            line(308, [word("1.404,90", 470, 308)]),
          ],
        },
      ],
    };

    const items = extractWithTemplate(structured, RK_STARK_TEMPLATE);
    expect(items.length).toBeGreaterThanOrEqual(1);
    const first = items.find((i) => i.position === "00010");
    expect(first?.description).toContain("Fermacell");
    expect(first?.description).toContain("1500x1000");
    expect(first?.description).toContain("Überlappend");
  });
});

import { describe, expect, it } from "vitest";
import { formatArtikelCell } from "./format-artikel";

describe("formatArtikelCell", () => {
  it("combines article number and description", () => {
    expect(
      formatArtikelCell({
        article_number: "249706",
        description: "Fermacell Estrich-Wabe",
      }),
    ).toBe("249706 Fermacell Estrich-Wabe");
  });

  it("returns description only when no article number", () => {
    expect(
      formatArtikelCell({
        article_number: null,
        description: "Nur Text",
      }),
    ).toBe("Nur Text");
  });

  it("does not duplicate article number if already in description", () => {
    expect(
      formatArtikelCell({
        article_number: "249706",
        description: "Art. 249706 Fermacell",
      }),
    ).toBe("Art. 249706 Fermacell");
  });
});

import { describe, expect, it } from "vitest";
import type { ExtractionResult } from "../extractor/models";
import { buildExcelBuffer } from "./excel";

describe("buildExcelBuffer", () => {
  it("returns a non-trivial xlsx buffer", async () => {
    const result: ExtractionResult = {
      layout_id: "test",
      source_pdf: "test.pdf",
      items: [
        {
          position: "1",
          article_number: "A-1",
          description: "Testartikel",
          quantity: 2,
          unit: "Stk",
          unit_price: 10,
          line_total: 20,
        },
        {
          position: "2",
          article_number: null,
          description: "Ohne Artikelnummer",
          quantity: 1,
          unit: "m",
          unit_price: 5.5,
          line_total: 5.5,
        },
      ],
    };

    const buf = await buildExcelBuffer(result, { aufschlag: 20 });
    expect(buf.byteLength).toBeGreaterThan(1000);
  });
});


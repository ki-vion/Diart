import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "../extractor/models";
import type { PdfStructured } from "../pdf/types";

const mockExtractPdfStructured = vi.fn();
const mockOcrStructuredFromPdf = vi.fn();
const mockDetectProfile = vi.fn();
const mockRunExtraction = vi.fn();
const mockBuildExcelBuffer = vi.fn();

vi.mock("../pdf/structured", () => ({
  extractPdfStructured: (...args: unknown[]) => mockExtractPdfStructured(...args),
}));

vi.mock("../pdf/ocr", () => ({
  ocrStructuredFromPdf: (...args: unknown[]) => mockOcrStructuredFromPdf(...args),
}));

vi.mock("../extractor", () => ({
  detectProfile: (...args: unknown[]) => mockDetectProfile(...args),
  runExtraction: (...args: unknown[]) => mockRunExtraction(...args),
}));

vi.mock("../export/excel", () => ({
  buildExcelBuffer: (...args: unknown[]) => mockBuildExcelBuffer(...args),
}));

import { convertPdfFile } from "./convert.web";

function makeStructured(rawText: string): PdfStructured {
  return {
    sourceFileName: "test.pdf",
    pages: [{ index: 0, width: 100, height: 100, lines: [], rawText }],
  };
}

function makeExtraction(layoutId: string): ExtractionResult {
  return {
    layout_id: layoutId,
    source_pdf: "test.pdf",
    items: [],
  };
}

describe("convertPdfFile OCR gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildExcelBuffer.mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it("runs OCR when initial profile is generic", async () => {
    const rawStructured = makeStructured("unknown");
    const ocrStructured = makeStructured("ocr result");
    mockExtractPdfStructured.mockResolvedValue(rawStructured);
    mockDetectProfile
      .mockReturnValueOnce("generic")
      .mockReturnValueOnce("generic");
    mockOcrStructuredFromPdf.mockResolvedValue(ocrStructured);
    mockRunExtraction.mockReturnValue(makeExtraction("generic-table"));

    const file = new File(["pdf"], "test.pdf", { type: "application/pdf" });
    const res = await convertPdfFile(file, 20);

    expect(mockOcrStructuredFromPdf).toHaveBeenCalledWith(file);
    expect(mockRunExtraction).toHaveBeenCalledWith(ocrStructured);
    expect(res.ok).toBe(true);
    expect(res.extraction_mode).toBe("table");
  });

  it("skips OCR when profile is known (Mahler)", async () => {
    const structured = makeStructured("Bauwaren Mahler GmbH");
    mockExtractPdfStructured.mockResolvedValue(structured);
    mockDetectProfile.mockReturnValue("Bauwaren Mahler");
    mockRunExtraction.mockReturnValue(makeExtraction("Bauwaren Mahler"));

    const file = new File(["pdf"], "mahler.pdf", { type: "application/pdf" });
    const res = await convertPdfFile(file, 20);

    expect(mockOcrStructuredFromPdf).not.toHaveBeenCalled();
    expect(mockRunExtraction).toHaveBeenCalledWith(structured);
    expect(res.ok).toBe(true);
    expect(res.extraction_mode).toBe("layout");
  });

  it("reports status messages via onStatus", async () => {
    const structured = makeStructured("unknown");
    const ocrStructured = makeStructured("ocr result");
    mockExtractPdfStructured.mockResolvedValue(structured);
    mockDetectProfile
      .mockReturnValueOnce("generic")
      .mockReturnValueOnce("generic");
    mockOcrStructuredFromPdf.mockResolvedValue(ocrStructured);
    mockRunExtraction.mockReturnValue(makeExtraction("generic-table"));

    const statuses: string[] = [];
    const file = new File(["pdf"], "test.pdf", { type: "application/pdf" });
    await convertPdfFile(file, 20, {
      onStatus: (msg) => statuses.push(msg),
    });

    expect(statuses).toContain("PDF wird gelesen…");
    expect(statuses).toContain("Unbekanntes Layout — OCR läuft…");
    expect(statuses).toContain("Positionen werden extrahiert…");
  });
});

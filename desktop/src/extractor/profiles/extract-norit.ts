import type { ExtractionResult, LineItem } from "../models";
import type { PdfStructured } from "../../pdf/types";
import { extractNoritStructured } from "../table/norit-structured";
import { findNoritAnchors, parseNoritBlock } from "../table/norit-block";

export function extractNorit(
  structured: PdfStructured,
  source_pdf: string,
): ExtractionResult {
  return {
    layout_id: "Norit",
    source_pdf,
    items: extractNoritStructured(structured),
  };
}

/** Legacy test helper: parse Norit from plain text lines. */
export function extractNoritFromLines(lines: string[], source_pdf: string): ExtractionResult {
  const anchors = findNoritAnchors(lines);
  const items = anchors
    .map((start, idx) => {
      const end = idx + 1 < anchors.length ? anchors[idx + 1]! : lines.length;
      const block = lines.slice(start, end);
      const lineBefore = lines[start - 1];
      return parseNoritBlock(block, lineBefore);
    })
    .filter((it): it is LineItem => it !== null);

  return {
    layout_id: "Norit",
    source_pdf,
    items,
  };
}

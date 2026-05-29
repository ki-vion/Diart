import type { PdfStructured } from "../../pdf/types";

/** Flatten MuPDF `asText()` lines in document order (matches legacy strategies). */
export function allAsTextLines(structured: PdfStructured): string[] {
  const lines: string[] = [];
  for (const page of structured.pages) {
    for (const line of page.rawText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed) lines.push(trimmed);
    }
  }
  return lines;
}

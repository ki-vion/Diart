import type { ExtractionResult, LineItem } from "../models";
import {
  clusterLineIntoCells,
  inferColumnBoundaries,
  type WordToken,
} from "./cluster-columns";
import { extractGenericTableItems } from "./generic-extract";
import { mapColumnsFromHeaderCells, type TableColumnMap } from "./header-map";
import { scoreHeaderLine } from "./item-blocks";
import { findTableRegion } from "./table-region";
import type { PdfLine, PdfPageStructured, PdfStructured } from "../../pdf/types";

export type { TableColumnMap } from "./header-map";

function lineToTokens(line: PdfLine): WordToken[] {
  return line.words.map((w) => ({ text: w.text, x: w.x }));
}

function findSingleLineTable(page: PdfPageStructured): {
  headerIndex: number;
  boundaries: number[];
  columnMap: TableColumnMap;
} | null {
  let best: {
    headerIndex: number;
    score: number;
    boundaries: number[];
    columnMap: TableColumnMap;
  } | null = null;

  for (let i = 0; i < page.lines.length; i++) {
    const line = page.lines[i]!;
    const score = scoreHeaderLine(line.text);
    if (score < 2) continue;

    const tokens = lineToTokens(line);
    const boundaries = inferColumnBoundaries(tokens);
    const cells = clusterLineIntoCells(tokens, boundaries);
    const columnMap = mapColumnsFromHeaderCells(cells);

    if (!best || score > best.score) {
      best = { headerIndex: i, score, boundaries, columnMap };
    }
  }

  if (!best) return null;
  return {
    headerIndex: best.headerIndex,
    boundaries: best.boundaries,
    columnMap: best.columnMap,
  };
}

function extractFromPage(page: PdfPageStructured): LineItem[] {
  const region = findTableRegion(page);
  if (region) {
    const items = extractGenericTableItems(page, region);
    if (items.length > 0) return items;
  }

  const singleLine = findSingleLineTable(page);
  if (singleLine) {
    const fullRegion = findTableRegion(page);
    if (fullRegion) {
      return extractGenericTableItems(page, fullRegion);
    }
    const syntheticRegion = {
      headerStart: singleLine.headerIndex,
      headerEnd: singleLine.headerIndex,
      dataStartIndex: singleLine.headerIndex + 1,
      dataEndIndex: page.lines.length,
      boundaries: singleLine.boundaries,
      columnMap: singleLine.columnMap,
    };
    return extractGenericTableItems(page, syntheticRegion);
  }

  return [];
}

function dedupeLineItems(items: LineItem[]): LineItem[] {
  const seen = new Set<string>();
  const out: LineItem[] = [];
  for (const it of items) {
    const key = [
      it.position ?? "",
      it.article_number ?? "",
      it.line_total ?? "",
      it.quantity ?? "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export function extractTableItems(
  structured: PdfStructured,
  source_pdf: string,
): ExtractionResult {
  const items: LineItem[] = [];
  for (const page of structured.pages) {
    items.push(...extractFromPage(page));
  }

  return {
    layout_id: "unbekannt",
    source_pdf,
    items: dedupeLineItems(items),
  };
}

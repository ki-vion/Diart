import type { LineItem } from "../models";
import { parseDeNumber } from "../utils";

const NORIT_NET = /^(?<net>[\d.,]+)\s+EUR\s*$/i;
const NORIT_QTY = /^(?<qty>[\d.,]+)\s+(?<unit>m²|m2|St|kg|l|qm)\s*$/i;
const UNIT_PRICE_LINE = /^(?<price>[\d.,]+)\s+EUR\s*\/\s*/i;
const EUR_PER = /EUR\s*\/\s*1/i;
import type { PdfLine, PdfStructured } from "../../pdf/types";
import type { ColumnRole } from "../table/header-map";
import { calibrateColumnWindows, lineToCells, trimCells } from "./columns";
import type { ColumnWindow, RowCells, TableTemplate } from "./types";
import { isPlausibleDescriptionLine } from "../table/line-guards";
import { isBlockAnchorInTable } from "../table/line-meta";
import { isNonItemLine } from "../table/table-zone";
import { findTableRegionOrContinuation } from "../table/table-region";

function isFooter(text: string): boolean {
  const t = text.trim();
  return /^(summe|gesamt|übertrag|seite\s+\d|nettowert|ust|endsumme)/i.test(t);
}

function parseAnchorFields(
  template: TableTemplate,
  line: PdfLine,
  cells: RowCells,
): Pick<LineItem, "position" | "article_number"> {
  const text = line.text.trim();
  const lineAnchor = template.lineAnchorPattern?.exec(text);
  if (lineAnchor?.groups) {
    return {
      position: lineAnchor.groups.pos ?? null,
      article_number: lineAnchor.groups.art ?? null,
    };
  }

  const pos = (cells.position ?? "").trim();
  const art = (cells.article ?? "").trim();

  if (template.layout_id === "RAAB Karcher" && pos && /^\d{5}\s+\d{6,}/.test(`${pos} ${art}`.trim())) {
    const m = /^(\d{5})\s+(\d{6,})/.exec(`${pos} ${art}`.trim());
    return { position: m?.[1] ?? pos, article_number: m?.[2] ?? art };
  }

  return {
    position: template.anchorPattern.test(pos) ? pos : null,
    article_number: /^\d{6,10}$/.test(art) ? art : null,
  };
}

function mergeCellsIntoItem(
  item: LineItem,
  cells: RowCells,
  lineText: string,
  line?: PdfLine,
  windows?: ColumnWindow[],
): void {
  const desc = cells.description?.trim();
  if (desc) {
    if (!windows || !line || isPlausibleDescriptionLine(line, windows)) {
      item.description = item.description ? `${item.description}\n${desc}`.trim() : desc;
    }
  }

  const qty = parseDeNumber(cells.quantity ?? "");
  if (qty !== null) item.quantity ??= qty;

  const unit = cells.unit?.trim();
  if (unit) item.unit ??= unit;

  let up = parseDeNumber(cells.unitPrice ?? "");
  if (up === null && UNIT_PRICE_LINE.test(lineText)) {
    up = parseDeNumber(UNIT_PRICE_LINE.exec(lineText)?.groups?.price ?? "");
  }
  if (up === null && EUR_PER.test(lineText)) {
    const m = /^([\d.,]+)/.exec(lineText);
    if (m) up = parseDeNumber(m[1] ?? "");
  }
  if (up !== null) item.unit_price ??= up;

  let total = parseDeNumber(cells.lineTotal ?? "");
  if (total === null && NORIT_NET.test(lineText)) {
    total = parseDeNumber(NORIT_NET.exec(lineText)?.groups?.net ?? "");
  }
  if (total !== null) item.line_total ??= total;

  const qtyLine = NORIT_QTY.exec(lineText);
  if (qtyLine?.groups) {
    const q = parseDeNumber(qtyLine.groups.qty ?? "");
    if (q !== null) item.quantity ??= q;
    item.unit ??= qtyLine.groups.unit ?? null;
  }

  if (/^\d{8}$/.test(lineText.trim())) {
    item.article_number ??= lineText.trim();
  }
}

function emptyItem(
  position: string | null,
  article_number: string | null,
): LineItem {
  return {
    position,
    article_number,
    artikel_prefix: null,
    description: "",
    quantity: null,
    unit: null,
    unit_price: null,
    line_total: null,
  };
}

function isDescriptionOnlyRow(cells: RowCells, anchorRole: ColumnRole): boolean {
  const desc = cells.description?.trim();
  if (!desc) return false;
  const anchor = cells[anchorRole]?.trim();
  if (anchor) return false;
  if (cells.quantity?.trim() || cells.unitPrice?.trim() || cells.lineTotal?.trim()) {
    return false;
  }
  return true;
}

/**
 * 4-step table extraction: Y-lines exist in PdfStructured → X columns → anchor rows → append descriptions.
 */
export function extractWithTemplate(
  structured: PdfStructured,
  template: TableTemplate,
): LineItem[] {
  const windows = calibrateColumnWindows(
    structured.pages,
    template.headerHints,
    template.defaultWindows,
    template.layout_id,
  );
  const catchAll = template.descriptionCatchAllMaxX ?? 320;

  const items: LineItem[] = [];
  let current: LineItem | null = null;

  for (const page of structured.pages) {
    const region = findTableRegionOrContinuation(page);
    const pageLines = page.lines;
    const dataStart = region?.dataStartIndex ?? 0;
    const dataEnd = region?.dataEndIndex ?? pageLines.length;

    for (let li = 0; li < pageLines.length; li++) {
      const line = pageLines[li]!;
      const text = line.text.trim();
      if (!text || isFooter(text)) continue;
      if (li < dataStart || li >= dataEnd) continue;
      if (isNonItemLine(line, page.height)) continue;
      if (template.skipLine?.test(text)) continue;
      if (template.minY !== undefined && line.y < template.minY) continue;

      const cells = trimCells(lineToCells(line, windows, catchAll));

      if (isBlockAnchorInTable(pageLines, li, dataStart, dataEnd, page.height)) {
        if (template.layout_id === "Norit") {
          const pos = (cells.position ?? "").trim();
          const n = Number.parseInt(pos, 10);
          const next = pageLines[li + 1]?.text.trim() ?? "";
          const prev = pageLines[li - 1]?.text.trim() ?? "";
          const validNorit =
            Number.isFinite(n) &&
            n >= 110 &&
            (NORIT_NET.test(next) || NORIT_QTY.test(prev));
          if (!validNorit) {
            if (current && isDescriptionOnlyRow(cells, template.anchorRole)) {
              if (isPlausibleDescriptionLine(line, windows)) {
                mergeCellsIntoItem(current, cells, text, line, windows);
              }
            }
            continue;
          }
        }

        if (current) items.push(current);
        const { position, article_number } = parseAnchorFields(template, line, cells);
        current = emptyItem(position, article_number);
        const prevText = pageLines[li - 1]?.text.trim() ?? "";
        if (template.layout_id === "Norit" && NORIT_QTY.test(prevText)) {
          mergeCellsIntoItem(current, {}, prevText);
        }
        mergeCellsIntoItem(current, cells, text, line, windows);
        continue;
      }

      if (!current) continue;

      if (isDescriptionOnlyRow(cells, template.anchorRole)) {
        if (isPlausibleDescriptionLine(line, windows)) {
          mergeCellsIntoItem(current, cells, text, line, windows);
        }
        continue;
      }

      const hasData = Boolean(
        cells.quantity ||
          cells.unitPrice ||
          cells.lineTotal ||
          cells.unit ||
          cells.description ||
          NORIT_NET.test(text) ||
          NORIT_QTY.test(text) ||
          UNIT_PRICE_LINE.test(text),
      );
      if (hasData) mergeCellsIntoItem(current, cells, text, line, windows);
    }
  }

  if (current) items.push(current);

  return items.filter(
    (it) =>
      it.description ||
      it.quantity !== null ||
      it.unit_price !== null ||
      it.line_total !== null,
  );
}

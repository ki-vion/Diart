import type { LineItem } from "../models";
import { parseDeNumber } from "../utils";
import type { PdfLine } from "../../pdf/types";
import { calibrateColumnWindows, lineToCells, trimCells } from "../pipeline/columns";
import type { ColumnWindow, RowCells, TableTemplate } from "../pipeline/types";
import { isBlockTerminatorLine, isPlausibleDescriptionLine } from "./line-guards";
import { isNonItemLine } from "./table-zone";
import { isRkNonItemText } from "../profiles/rk-footer";

const UNIT_PRICE_LINE = /^(?<price>[\d.,]+)\s+EUR\s*\/\s*/i;
const EUR_PER = /EUR\s*\/\s*1/i;
const BILLING_UNIT_ONLY = /^(ST|M2|SA|FL|PKT|St|Stück|Stk|kg\/Sa)$/i;
const HAS_LETTERS = /[A-Za-zÄÖÜäöüß]/;

export type ColumnBlockContext = {
  template: TableTemplate;
  windows: ColumnWindow[];
  catchAllMaxX: number;
};

export function columnContextFromTemplate(
  template: TableTemplate,
  pages: { lines: PdfLine[] }[],
): ColumnBlockContext {
  return {
    template,
    windows: calibrateColumnWindows(
      pages,
      template.headerHints,
      template.defaultWindows,
      template.layout_id,
    ),
    catchAllMaxX: template.descriptionCatchAllMaxX ?? 320,
  };
}

function emptyItem(position: string | null, article_number: string | null): LineItem {
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

function appendDescription(item: LineItem, text: string): void {
  const t = text.trim();
  if (!t) return;
  item.description = item.description ? `${item.description}\n${t}`.trim() : t;
}

function parseAnchorFromCells(
  ctx: ColumnBlockContext,
  line: PdfLine,
  cells: RowCells,
): Pick<LineItem, "position" | "article_number"> {
  const text = line.text.trim();
  const lineAnchor = ctx.template.lineAnchorPattern?.exec(text);
  if (lineAnchor?.groups) {
    return {
      position: lineAnchor.groups.pos ?? null,
      article_number: lineAnchor.groups.art ?? null,
    };
  }

  const pos = (cells.position ?? "").trim();
  const art = (cells.article ?? "").trim();

  if (ctx.template.layout_id === "RAAB Karcher" && pos && /^\d{5}\s+\d{6,}/.test(`${pos} ${art}`.trim())) {
    const m = /^(\d{5})\s+(\d{6,})/.exec(`${pos} ${art}`.trim());
    return { position: m?.[1] ?? pos, article_number: m?.[2] ?? art };
  }

  if (ctx.template.anchorPattern.test(pos)) {
    return {
      position: pos,
      article_number: /^\d{6,10}$/.test(art) ? art : null,
    };
  }

  if (/^\d{5}$/.test(pos) && /^\d{6,}$/.test(art)) {
    return { position: pos, article_number: art };
  }

  return {
    position: ctx.template.anchorPattern.test(pos) ? pos : null,
    article_number: /^\d{6,10}$/.test(art) ? art : null,
  };
}

function isBillingRow(cells: RowCells): boolean {
  if (cells.quantity?.trim() || cells.unitPrice?.trim() || cells.lineTotal?.trim()) {
    return true;
  }
  const unit = cells.unit?.trim() ?? "";
  const desc = cells.description?.trim() ?? "";
  const art = cells.article?.trim() ?? "";
  return Boolean(unit && !desc && !art);
}

/** Keine Beschreibungszeile: Formeln, Einheiten, Pos/Art-Nr., reine Zahlen. */
function isNoiseArtikelText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^<b>$/i.test(t)) return true;
  if (/^\d{5}$/.test(t)) return true;
  if (/^\d{6,10}$/.test(t)) return true;
  if (BILLING_UNIT_ONLY.test(t)) return true;
  if (/^=\s*[\d.,]+/.test(t) || t === "=") return true;
  if (/^[\d.,]+$/.test(t)) return true;
  if (/^EUR\//i.test(t)) return true;
  return false;
}

function normalizePackagingLine(desc: string, art: string, lineText: string): string | null {
  if (desc && /^\d+([.,]\d+)?$/.test(desc) && art && /\//i.test(art)) {
    return `${desc} ${art}`.trim();
  }
  const line = lineText.trim();
  const forward = /^([\d.,]+)\s+(\S+\/\S+)/i.exec(line);
  if (forward) return `${forward[1]} ${forward[2]}`.trim();
  const reverse = /^(\S+\/\S+)\s+([\d.,]+)/i.exec(line);
  if (reverse) return `${reverse[2]} ${reverse[1]}`.trim();
  return null;
}

function pickArtikelLineText(cells: RowCells, lineText: string): string | null {
  const desc = cells.description?.trim() ?? "";
  const art = cells.article?.trim() ?? "";

  if (/^\d{6,10}$/.test(art) && !desc) return null;

  const packaging = normalizePackagingLine(desc, art, lineText);
  if (packaging) return packaging;

  if (desc && isNoiseArtikelText(desc)) return null;
  if (desc && HAS_LETTERS.test(desc)) return desc;
  if (art && !/^\d{6,10}$/.test(art) && HAS_LETTERS.test(art) && !isNoiseArtikelText(art)) {
    return art;
  }
  const line = lineText.trim();
  if (line && HAS_LETTERS.test(line) && !isNoiseArtikelText(line)) return line;
  return null;
}

function mergeBillingFields(item: LineItem, cells: RowCells, lineText: string): void {
  const qtyRaw = cells.quantity?.trim() ?? "";
  if (qtyRaw) {
    const q = parseDeNumber(qtyRaw);
    if (q !== null) item.quantity ??= q;
    else {
      const m = /^([\d.,]+)\s+(.+)$/.exec(qtyRaw);
      if (m) {
        const parsed = parseDeNumber(m[1] ?? "");
        if (parsed !== null) item.quantity ??= parsed;
        if (m[2]) item.unit ??= m[2].trim();
      }
    }
  }

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

  const total = parseDeNumber(cells.lineTotal ?? "");
  if (total !== null) item.line_total ??= total;
}

function applyArtikelLine(
  item: LineItem,
  line: PdfLine,
  cells: RowCells,
  ctx: ColumnBlockContext,
): void {
  const art = cells.article?.trim();
  if (art && /^\d{6,10}$/.test(art) && !item.article_number) {
    item.article_number = art;
  }
  const text = pickArtikelLineText(cells, line.text);
  if (text && isPlausibleDescriptionLine(line, ctx.windows)) {
    appendDescription(item, text);
  }
}

function appendDescriptionFromCells(
  item: LineItem,
  line: PdfLine,
  cells: RowCells,
  ctx: ColumnBlockContext,
): void {
  const desc = cells.description?.trim() ?? "";
  if (!desc || isNoiseArtikelText(desc)) return;
  const text = pickArtikelLineText(cells, line.text) ?? desc;
  if (text && isPlausibleDescriptionLine(line, ctx.windows)) {
    appendDescription(item, text);
  }
}

function processTableLine(
  item: LineItem,
  line: PdfLine,
  cells: RowCells,
  ctx: ColumnBlockContext,
): void {
  if (isBillingRow(cells)) {
    mergeBillingFields(item, cells, line.text);
    appendDescriptionFromCells(item, line, cells, ctx);
    return;
  }
  applyArtikelLine(item, line, cells, ctx);
}

function finalizeRkDescription(item: LineItem): void {
  const art = item.article_number?.trim();
  if (!art) return;
  const desc = item.description?.trim() ?? "";
  if (!desc) {
    item.description = art;
    return;
  }
  if (desc === art || desc.startsWith(`${art}\n`) || desc.startsWith(`${art} `)) return;
  item.description = `${art}\n${desc}`;
}

function tryOpenItem(
  lines: PdfLine[],
  startIdx: number,
  ctx: ColumnBlockContext,
): { item: LineItem; nextIdx: number } | null {
  const line = lines[startIdx]!;
  const text = line.text.trim();
  const cells = trimCells(lineToCells(line, ctx.windows, ctx.catchAllMaxX));
  let anchor = parseAnchorFromCells(ctx, line, cells);

  if (!anchor.position && !anchor.article_number) {
    const posOnly = cells.position?.trim() ?? (/^\d{5}$/.test(text) ? text : "");
    const next = lines[startIdx + 1];
    const nextCells = next
      ? trimCells(lineToCells(next, ctx.windows, ctx.catchAllMaxX))
      : {};
    const art =
      nextCells.article?.trim() ??
      (next && /^\d{6,}$/.test(next.text.trim()) ? next.text.trim() : "");
    if (ctx.template.layout_id === "RAAB Karcher" && /^\d{5}$/.test(posOnly) && /^\d{6,}$/.test(art)) {
      anchor = { position: posOnly, article_number: art };
      const item = emptyItem(anchor.position, anchor.article_number);
      processTableLine(item, line, cells, ctx);
      return { item, nextIdx: startIdx + 2 };
    }
    return null;
  }

  const item = emptyItem(anchor.position, anchor.article_number);
  processTableLine(item, line, cells, ctx);
  return { item, nextIdx: startIdx + 1 };
}

function shouldSkipLine(text: string, template: TableTemplate): boolean {
  if (!text) return true;
  if (text === "<B>" || /^<b>$/i.test(text)) return true;
  if (template.skipLine?.test(text)) return true;
  return false;
}

/**
 * Parse one anchor block using calibrated X columns only.
 * Billing qty/price/total come from their columns; Artikel/Bezeichnung → description.
 */
export function parseColumnItemBlock(
  lines: PdfLine[],
  ctx: ColumnBlockContext,
): LineItem | null {
  if (lines.length === 0) return null;

  let i = 0;
  while (i < lines.length && shouldSkipLine(lines[i]!.text.trim(), ctx.template)) {
    i += 1;
  }
  if (i >= lines.length) return null;

  const opened = tryOpenItem(lines, i, ctx);
  if (!opened) return null;

  const item = opened.item;
  i = opened.nextIdx;

  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const text = line.text.trim();
    if (shouldSkipLine(text, ctx.template)) continue;
    if (isBlockTerminatorLine(text)) break;
    if (isNonItemLine(line, 842)) break;
    if (isRkNonItemText(text)) break;

    const cells = trimCells(lineToCells(line, ctx.windows, ctx.catchAllMaxX));
    if (cells.position?.trim() === item.position && !cells.description?.trim()) {
      if (isBillingRow(cells)) mergeBillingFields(item, cells, text);
      continue;
    }
    processTableLine(item, line, cells, ctx);
  }

  const hasValue =
    item.quantity !== null ||
    item.unit_price !== null ||
    item.line_total !== null;
  if (!hasValue && !item.description) return null;

  if (ctx.template.layout_id === "RAAB Karcher") {
    finalizeRkDescription(item);
  }

  return item;
}

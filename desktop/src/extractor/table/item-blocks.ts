import type { LineItem } from "../models";
import { parseDeNumber } from "../utils";
import { parseRkBlock } from "../profiles/extract-rk-legacy";
import type { PdfLine } from "../../pdf/types";
import { isNonItemLine } from "./table-zone";
import { clusterLineIntoCells } from "./cluster-columns";
import { parseColumnItemBlock, type ColumnBlockContext } from "./column-block";
import {
  collectKanLeadingIntro,
  mergeKanPreamble,
  splitBlockLinesForParsing,
} from "./block-gaps";
import {
  isBlockTerminatorLine,
  isPlausibleDescriptionLine,
  isPlausibleDescriptionLineByBoundaries,
  trimBlockLines,
} from "./line-guards";
import { isKanSplitAnchor, KAN_POS_MERGED, parseKanBlock } from "./kan-block";
import {
  extractLaierArticleId,
  isLaierItemAnchor,
  parseLaierBlock,
  parseLaierColumnBlock,
} from "./laier-block";
import {
  isNoritItemAnchor as isNoritAnchorLine,
  NORIT_POS,
  parseNoritBlock,
} from "./norit-block.ts";
import { HEADER_HINTS, type ColumnRole, type TableColumnMap } from "./header-map";

const RK_HEAD = /^(?<pos>\d{5})\s*(?<art>\d{6,})\b/;
const RK_HEAD_LINE = /^\d{5}\s*\d{6,}\b/;
const KAN_HEAD = KAN_POS_MERGED;
const NORIT_NET = /^(?<net>[\d.,]+)\s+EUR\s*$/i;

const QTY_ONLY = /^[\d.,]+$/;
const QTY_UNIT_LINE =
  /^(?<qty>[\d.,]+)\s+(?<unit>.+)$/i;
const UNIT_ONLY =
  /^(?<u>ST|M2|SA|St|Stück|Stk|kg|l|m²|m2|qm|Pal\.?|Karton)$/i;
const UNIT_PRICE_LINE =
  /^(?<price>[\d.,]+)\s+EUR\s*\/\s*(?<per>.+)$/i;
const PRICE_ONLY = /^[\d.,]+$/;
const EUR_PER = /EUR\s*\/\s*1/i;

const SKIP_LINE =
  /^(<b>|pos\.|übertrag|seite\s+\d|angbot|kunden|in eur$|abw\.|zolltarif|produkt|coc-|länge:|breite:|charge:|vpe:|abmessung:|artikelnummer:|bestell)/i;

export type BlockAnchorKind = "rk" | "kan" | "norit" | "laier";

export type BlockAnchor = {
  lineIndex: number;
  kind: BlockAnchorKind;
};

export function scoreHeaderLine(text: string): number {
  const norm = text
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/[-–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let score = 0;
  for (const hints of Object.values(HEADER_HINTS)) {
    for (const h of hints) {
      const token = h.replace(/\./g, "").trim();
      if (!token) continue;
      const re = new RegExp(`(?:^|\\s)${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "i");
      if (re.test(norm)) score += 1;
    }
  }
  return score;
}

function isNoritAnchor(lines: PdfLine[], i: number): boolean {
  const texts = lines.map((l) => l.text.trim());
  return isNoritAnchorLine(texts, i);
}

export function findBlockAnchors(lines: PdfLine[], fromIndex: number): BlockAnchor[] {
  const anchors: BlockAnchor[] = [];

  for (let i = fromIndex; i < lines.length; i++) {
    const t = lines[i]!.text.trim();
    if (!t || SKIP_LINE.test(t)) continue;

    if (RK_HEAD.test(t) || RK_HEAD_LINE.test(t)) {
      anchors.push({ lineIndex: i, kind: "rk" });
      continue;
    }
    if (/^\d{5}$/.test(t) && /^\d{6,}$/.test(lines[i + 1]?.text.trim() ?? "")) {
      anchors.push({ lineIndex: i, kind: "rk" });
      continue;
    }
    if (KAN_HEAD.test(t)) {
      anchors.push({ lineIndex: i, kind: "kan" });
      continue;
    }
    if (isKanSplitAnchor(lines, i)) {
      anchors.push({ lineIndex: i, kind: "kan" });
      continue;
    }
    if (isLaierItemAnchor(lines, i)) {
      anchors.push({ lineIndex: i, kind: "laier" });
      continue;
    }
    if (isNoritAnchor(lines, i)) {
      anchors.push({ lineIndex: i, kind: "norit" });
    }
  }

  return anchors;
}

function shouldSkipBlockLine(t: string): boolean {
  if (!t) return true;
  if (SKIP_LINE.test(t)) return true;
  if (t === "<B>") return true;
  if (scoreHeaderLine(t) >= 2) return true;
  return false;
}


export type ItemBlockParseContext = {
  columnBlock?: ColumnBlockContext;
};

/** Parse stacked lines between two position anchors (RK, KAN, Norit, Laier). */
export function parseItemBlock(
  lines: PdfLine[],
  boundaries: number[],
  columnMap: TableColumnMap,
  parseCtx?: ItemBlockParseContext,
): LineItem | null {
  const texts = lines.map((l) => l.text.trim()).filter(Boolean);
  if (texts.length === 0) return null;

  const kanBlock = parseKanBlock(lines);
  if (kanBlock) return kanBlock;

  const rkHead =
    RK_HEAD.exec(texts[0] ?? "") ??
    (RK_HEAD_LINE.test(texts[0] ?? "")
      ? RK_HEAD.exec(texts[0]!.replace(/(\d{5})(\d{6,})/, "$1 $2"))
      : null);
  const rkSplit =
    /^\d{5}$/.test(texts[0] ?? "") && /^\d{6,}$/.test(texts[1] ?? "");
  const isRkBlock = Boolean(rkHead?.groups || RK_HEAD_LINE.test(texts[0] ?? "") || rkSplit);

  if (isRkBlock && parseCtx?.columnBlock) {
    const fromColumns = parseColumnItemBlock(lines, parseCtx.columnBlock);
    if (fromColumns) return fromColumns;
  }

  let position: string | null = null;
  let article_number: string | null = null;
  let startIdx = 0;

  if (isRkBlock) {
    const fromRk = parseRkBlock(texts);
    if (fromRk) return fromRk;
    if (rkHead?.groups) {
      position = rkHead.groups.pos ?? null;
      article_number = rkHead.groups.art ?? null;
      startIdx = 1;
    } else if (rkSplit) {
      position = texts[0] ?? null;
      article_number = texts[1] ?? null;
      startIdx = 2;
    }
  }

  const kan = KAN_HEAD.exec(texts[0] ?? "");
  if (kan?.groups) {
    position = kan.groups.pos ?? null;
    article_number = kan.groups.art ?? null;
    startIdx = 1;
  }

  if (NORIT_POS.test(texts[0] ?? "")) {
    return parseNoritBlock(texts);
  }

  if (extractLaierArticleId(texts[0] ?? "")) {
    if (parseCtx?.columnBlock) {
      return parseLaierColumnBlock(lines, parseCtx.columnBlock);
    }
    return parseLaierBlock(texts);
  }

  const state = {
    quantity: null as number | null,
    unit: null as string | null,
    unit_price: null as number | null,
    line_total: null as number | null,
  };
  const descParts: string[] = [];
  const priceDecimals: number[] = [];

  const windows = parseCtx?.columnBlock?.windows;

  for (let i = startIdx; i < texts.length; i++) {
    const t = texts[i]!;
    if (shouldSkipBlockLine(t)) continue;
    if (isBlockTerminatorLine(t)) break;
    if (isNonItemLine(lines[i]!, 842)) break;

    if (NORIT_NET.test(t)) {
      const m = NORIT_NET.exec(t);
      state.line_total = parseDeNumber(m?.groups?.net ?? "");
      continue;
    }

    const colCells =
      boundaries.length > 0
        ? clusterLineIntoCells(
            lines[i]!.words.map((w) => ({ text: w.text, x: w.x })),
            boundaries,
          )
        : null;

    if (colCells) {
      const fromCols = readFieldsFromCells(colCells, columnMap);
      if (fromCols.quantity !== undefined) state.quantity ??= fromCols.quantity;
      if (fromCols.unit) state.unit ??= fromCols.unit;
      if (fromCols.unit_price !== undefined) state.unit_price ??= fromCols.unit_price;
      if (fromCols.line_total !== undefined) state.line_total ??= fromCols.line_total;
      if (fromCols.description) {
        const line = lines[i]!;
        const plausible = windows
          ? isPlausibleDescriptionLine(line, windows)
          : boundaries.length > 0
            ? isPlausibleDescriptionLineByBoundaries(line, boundaries)
            : true;
        if (plausible) {
          const full = line.text.trim();
          descParts.push(full.length >= fromCols.description.length ? full : fromCols.description);
        }
      }
      continue;
    }

    const unitPrice = UNIT_PRICE_LINE.exec(t);
    if (unitPrice?.groups) {
      state.unit_price ??= parseDeNumber(unitPrice.groups.price ?? "");
      continue;
    }

    if (EUR_PER.test(t)) {
      const m = /^([\d.,]+)/.exec(t);
      if (m) state.unit_price ??= parseDeNumber(m[1] ?? "");
      continue;
    }

    const qtyUnit = QTY_UNIT_LINE.exec(t);
    if (qtyUnit?.groups?.qty) {
      state.quantity ??= parseDeNumber(qtyUnit.groups.qty);
      if (qtyUnit.groups.unit) state.unit ??= qtyUnit.groups.unit.trim();
      continue;
    }

    if (UNIT_ONLY.test(t)) {
      state.unit ??= UNIT_ONLY.exec(t)?.groups?.u ?? t;
      continue;
    }

    if (QTY_ONLY.test(t) && state.quantity === null && !t.includes(",")) {
      const q = parseDeNumber(t);
      if (q !== null && q < 100_000) {
        state.quantity = q;
        continue;
      }
    }

    if (PRICE_ONLY.test(t)) {
      const n = parseDeNumber(t);
      if (n !== null && n !== state.quantity) priceDecimals.push(n);
      continue;
    }

    if (t.startsWith("=")) continue;

    if (!RK_HEAD.test(t) && !KAN_HEAD.test(t) && !NORIT_POS.test(t)) {
      const line = lines[i]!;
      const plausible = windows
        ? isPlausibleDescriptionLine(line, windows)
        : boundaries.length > 0
          ? isPlausibleDescriptionLineByBoundaries(line, boundaries)
          : true;
      if (plausible) descParts.push(t);
    }
  }

  if (priceDecimals.length >= 2) {
    state.unit_price ??= priceDecimals[priceDecimals.length - 2]!;
    state.line_total ??= priceDecimals[priceDecimals.length - 1]!;
  } else if (priceDecimals.length === 1) {
    const n = priceDecimals[0]!;
    if (n >= 500 && state.line_total === null) {
      state.line_total = n;
    } else {
      state.unit_price ??= n;
    }
  }

  const hasValue =
    state.quantity !== null || state.unit_price !== null || state.line_total !== null;
  if (!hasValue) return null;

  return {
    position,
    article_number,
    artikel_prefix: null,
    description: descParts.join("\n").trim(),
    quantity: state.quantity,
    unit: state.unit,
    unit_price: state.unit_price,
    line_total: state.line_total,
  };
}

function readFieldsFromCells(
  cells: string[],
  map: TableColumnMap,
): {
  quantity?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  line_total?: number | null;
  description?: string;
} {
  const out: {
    quantity?: number | null;
    unit?: string | null;
    unit_price?: number | null;
    line_total?: number | null;
    description?: string;
  } = {};

  const pick = (role: ColumnRole) => {
    const idx = map[role];
    if (idx === undefined) return "";
    return (cells[idx] ?? "").trim();
  };

  const qty = parseDeNumber(pick("quantity"));
  if (qty !== null) out.quantity = qty;
  const unit = pick("unit");
  if (unit) out.unit = unit;
  const up = parseDeNumber(pick("unitPrice"));
  if (up !== null) out.unit_price = up;
  const lt = parseDeNumber(pick("lineTotal"));
  if (lt !== null) out.line_total = lt;
  const desc = pick("description");
  if (desc) out.description = desc;

  return out;
}

export { findTableRegion, findTableRegionOrContinuation, type TableRegion } from "./table-region";

export function extractBlocksFromPage(
  page: { lines: PdfLine[] },
  region: {
    dataStartIndex: number;
    dataEndIndex: number;
    boundaries: number[];
    columnMap: TableColumnMap;
  },
  parseCtx?: ItemBlockParseContext,
): LineItem[] {
  const endLimit = region.dataEndIndex ?? page.lines.length;
  const anchors = findBlockAnchors(page.lines, region.dataStartIndex).filter(
    (a) => a.lineIndex < endLimit,
  );
  if (anchors.length === 0) return [];

  const items: LineItem[] = [];
  let preamble: PdfLine[] = [];

  for (let a = 0; a < anchors.length; a++) {
    const start = anchors[a]!.lineIndex;
    const minBefore =
      a > 0 ? anchors[a - 1]!.lineIndex + 1 : region.dataStartIndex;
    if (anchors[a]!.kind === "kan") {
      preamble = mergeKanPreamble(
        preamble,
        collectKanLeadingIntro(page.lines, start, minBefore),
      );
    }
    const nextStart = a + 1 < anchors.length ? anchors[a + 1]!.lineIndex : endLimit;
    const end = Math.min(nextStart, endLimit);
    const anchorLine = page.lines[start]!;
    const rawBlock = trimBlockLines(
      [anchorLine, ...page.lines.slice(start + 1, end)],
      { windows: parseCtx?.columnBlock?.windows },
    );

    const { parseLines, carryToNext } = splitBlockLinesForParsing(rawBlock);

    const item = parseItemBlock(parseLines, region.boundaries, region.columnMap, parseCtx);
    if (item && (item.position ?? item.article_number)) {
      if (preamble.length > 0) {
        item.artikel_prefix = preamble
          .map((l) => l.text.trim())
          .filter(Boolean)
          .join("\n");
      }
      items.push(item);
    }

    preamble = carryToNext;
  }
  return items;
}

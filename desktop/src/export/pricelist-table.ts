import type { ExtractionResult, LineItem } from "../extractor/models";

/** Price-list export (e.g. Norit Konditionen): PDF table 1:1, no Aufschlag/Summen. */
export type PricelistCell = string | number | null;

export type PricelistRow =
  | { kind: "section"; title: string }
  | { kind: "header"; cells: string[] }
  | { kind: "item"; cells: PricelistCell[] }
  | { kind: "spacer" };

export type PricelistTable = {
  columnCount: number;
  /** 0-based indexes of the euro price columns. */
  priceColumns: number[];
  rows: PricelistRow[];
};

const FIXED_LEADING = ["Teilenr.", "Teilebezeichnung"] as const;
const UNIT_HEADER = "Einheit";

export function isPricelistResult(result: Pick<ExtractionResult, "items">): boolean {
  return result.items.length > 0 && result.items.every((it) => (it.tier_prices?.length ?? 0) > 0);
}

type Section = { title: string; labels: string[]; items: LineItem[] };

function groupSections(items: LineItem[]): Section[] {
  const sections: Section[] = [];
  for (const item of items) {
    const title = item.section ?? "";
    let current = sections[sections.length - 1];
    if (!current || current.title !== title) {
      current = { title, labels: [], items: [] };
      sections.push(current);
    }
    for (const tier of item.tier_prices ?? []) {
      if (!current.labels.includes(tier.label)) current.labels.push(tier.label);
    }
    current.items.push(item);
  }
  return sections;
}

function itemCells(item: LineItem, labels: string[], priceCount: number): PricelistCell[] {
  const prices: PricelistCell[] = Array.from({ length: priceCount }, (_, i) => {
    const label = labels[i];
    const tier = item.tier_prices?.find((t) => t.label === label);
    return tier ? tier.price : null;
  });
  return [item.article_number, item.description, ...prices, item.unit];
}

function headerCells(labels: string[], priceCount: number): string[] {
  const priceHeaders = Array.from({ length: priceCount }, (_, i) => {
    const label = labels[i];
    return label ? `${label} (€)` : "";
  });
  return [...FIXED_LEADING, ...priceHeaders, UNIT_HEADER];
}

export function buildPricelistTable(items: LineItem[]): PricelistTable {
  const sections = groupSections(items);
  const priceCount = Math.max(1, ...sections.map((s) => s.labels.length));
  const rows: PricelistRow[] = [];

  sections.forEach((section, idx) => {
    if (idx > 0) rows.push({ kind: "spacer" });
    if (section.title) rows.push({ kind: "section", title: section.title });
    rows.push({ kind: "header", cells: headerCells(section.labels, priceCount) });
    for (const item of section.items) {
      rows.push({ kind: "item", cells: itemCells(item, section.labels, priceCount) });
    }
  });

  return {
    columnCount: FIXED_LEADING.length + priceCount + 1,
    priceColumns: Array.from({ length: priceCount }, (_, i) => FIXED_LEADING.length + i),
    rows,
  };
}

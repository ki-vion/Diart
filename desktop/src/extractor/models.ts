export type LineItem = {
  position: string | null;
  article_number: string | null;
  /** Shown above article number in Excel (e.g. RK „Alternativposition zu Position …“). */
  artikel_prefix: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  line_total: number | null;
  /** Divisor for unit price basis, e.g. 100 for „(Preis per 100)“. */
  price_per?: number | null;
};

export type ExtractionResult = {
  layout_id: string;
  source_pdf: string;
  items: LineItem[];
};


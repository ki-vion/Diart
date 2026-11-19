/** One price column of a supplier price list, e.g. „ab 5 t“ → 15,50. */
export type TierPrice = {
  label: string;
  price: number;
};

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
  /**
   * VK-Rabatt aus der VK-Preis Spalte, z.B. parsed aus „--10 %“ => 10.
   * Wird für die Excel-Gesamtberechnung verwendet.
   */
  vk_discount_percent?: number | null;
  /** Divisor for unit price basis, e.g. 100 for „(Preis per 100)“. */
  price_per?: number | null;
  /** Price-list section title (e.g. Norit Konditionen „NORIT-Trockenestrich“). */
  section?: string | null;
  /** Price-list columns kept from the PDF table (e.g. „ab 5 t“, „ab 12 t“). */
  tier_prices?: TierPrice[] | null;
};

export type ExtractionResult = {
  layout_id: string;
  source_pdf: string;
  items: LineItem[];
};


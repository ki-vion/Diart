export type LineItem = {
  position: string | null;
  article_number: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  line_total: number | null;
};

export type ExtractionResult = {
  layout_id: string;
  source_pdf: string;
  items: LineItem[];
};


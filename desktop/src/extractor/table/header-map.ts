export const HEADER_HINTS = {
  position: ["pos", "position", "pos."],
  article: ["artikel", "artikelnummer", "art.-nr", "artnr", "artikel-nr"],
  description: ["bezeichnung", "beschreibung", "produkt", "artikelbezeichnung"],
  quantity: ["menge", "anzahl", "qty"],
  unit: ["einheit", "me", "unit"],
  unitPrice: ["einzelpreis", "e.-preis", "ep", "preis", "vk", "einzel-preis"],
  lineTotal: ["gesamt", "nettowert", "summe", "betrag", "pos.-wert", "pos-wert"],
} as const;

export type ColumnRole = keyof typeof HEADER_HINTS;

export type TableColumnMap = Partial<Record<ColumnRole, number>>;

import type { TableTemplate } from "./types";

/** STARK / Raab Karcher — tabellarische X-Spalten + mehrzeilige Beschreibung links */
export const RK_STARK_TEMPLATE: TableTemplate = {
  layout_id: "RAAB Karcher",
  anchorRole: "position",
  anchorPattern: /^\d{5}$/,
  lineAnchorPattern: /^(?<pos>\d{5})\s+(?<art>\d{6,})\b/,
  headerHints: {
    position: ["pos"],
    article: ["artikel"],
    quantity: ["menge"],
    unit: ["me"],
    unitPrice: ["einzel", "preis"],
    lineTotal: ["pos-wert", "wert"],
    description: ["bezeichnung", "artikelbezeichnung"],
  },
  /** Numeric columns are right-aligned in PDFs — bands are wide and use word overlap, not left edge only. */
  defaultWindows: [
    { role: "position", xMin: 0, xMax: 68 },
    { role: "article", xMin: 68, xMax: 140 },
    { role: "description", xMin: 40, xMax: 295 },
    { role: "quantity", xMin: 268, xMax: 382 },
    { role: "unit", xMin: 318, xMax: 382 },
    { role: "unitPrice", xMin: 368, xMax: 508 },
    { role: "lineTotal", xMin: 478, xMax: 600 },
  ],
  descriptionCatchAllMaxX: 295,
  skipLine: /^(<b>|in eur|pos\.|artikel-nr|übertrag)/i,
  minY: 180,
};

/** Norit Rechnung — Positionsnummer als Anker, Beschreibung links/mitte */
export const NORIT_TEMPLATE: TableTemplate = {
  layout_id: "Norit",
  anchorRole: "position",
  anchorPattern: /^\d{3}$/,
  headerHints: {
    position: ["pos"],
    description: ["artikel"],
    quantity: ["menge"],
    unitPrice: ["einzelpreis"],
    lineTotal: ["nettowert"],
  },
  defaultWindows: [
    { role: "position", xMin: 0, xMax: 82 },
    { role: "description", xMin: 82, xMax: 180 },
    { role: "quantity", xMin: 180, xMax: 320 },
    { role: "unitPrice", xMin: 320, xMax: 434 },
    { role: "lineTotal", xMin: 434, xMax: 600 },
  ],
  descriptionCatchAllMaxX: 180,
  skipLine: /^(abw\.|rechnungsnummer|seite:)/i,
};

/** Rudolf Laier Angebot — keine Pos.-Spalte, Artikel-ID (8 Ziffern / R-Code) als Block-Anker */
export const LAIER_VAN_TEMPLATE: TableTemplate = {
  layout_id: "Rudolf Laier GmbH",
  anchorRole: "article",
  anchorPattern: /^\d{8}$/,
  headerHints: {
    article: ["artikel"],
    quantity: ["menge"],
    unit: ["einheit"],
    unitPrice: ["vk-preis", "vk"],
    lineTotal: ["betrag"],
  },
  defaultWindows: [
    { role: "article", xMin: 0, xMax: 300 },
    { role: "description", xMin: 0, xMax: 310 },
    { role: "quantity", xMin: 300, xMax: 352 },
    { role: "unit", xMin: 340, xMax: 400 },
    { role: "unitPrice", xMin: 395, xMax: 510 },
    { role: "lineTotal", xMin: 500, xMax: 600 },
  ],
  descriptionCatchAllMaxX: 310,
  skipLine: /^(<b>|alternativposition|menge einheit|vk-preis|betrag$|sonstiges)/i,
  minY: 250,
};

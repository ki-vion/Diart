import type { TableTemplate } from "./types";

/** STARK / Raab Karcher — tabellarische X-Spalten + mehrzeilige Beschreibung links */
export const RK_STARK_TEMPLATE: TableTemplate = {
  layout_id: "rk_stark",
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
  defaultWindows: [
    { role: "position", xMin: 0, xMax: 95 },
    { role: "article", xMin: 95, xMax: 135 },
    { role: "description", xMin: 40, xMax: 295 },
    { role: "quantity", xMin: 295, xMax: 340 },
    { role: "unit", xMin: 318, xMax: 375 },
    { role: "unitPrice", xMin: 375, xMax: 440 },
    { role: "lineTotal", xMin: 440, xMax: 600 },
  ],
  descriptionCatchAllMaxX: 295,
  skipLine: /^(<b>|in eur|pos\.|artikel-nr|übertrag)/i,
  minY: 180,
};

/** Norit Rechnung — Positionsnummer als Anker, Beschreibung links/mitte */
export const NORIT_TEMPLATE: TableTemplate = {
  layout_id: "norit_rechnung",
  anchorRole: "position",
  anchorPattern: /^\d{3}$/,
  headerHints: {
    position: ["pos"],
    quantity: ["menge"],
    unitPrice: ["einzelpreis"],
    lineTotal: ["nettowert"],
    description: ["artikel"],
  },
  defaultWindows: [
    { role: "position", xMin: 0, xMax: 90 },
    { role: "description", xMin: 90, xMax: 400 },
    { role: "quantity", xMin: 400, xMax: 480 },
    { role: "lineTotal", xMin: 460, xMax: 560 },
    { role: "unitPrice", xMin: 400, xMax: 560 },
  ],
  descriptionCatchAllMaxX: 420,
  skipLine: /^(abw\.|zolltarif|produkt|coc-|länge:|breite:|charge:|vpe:|abmessung:|artikelnummer:|rechnungsnummer|seite:)/i,
};

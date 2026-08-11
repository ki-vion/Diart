export const HEADER_HINTS = {
  position: ["pos", "position", "pos."],
  article: ["artikel", "artikelnummer", "art.-nr", "artnr", "artikel-nr"],
  description: ["bezeichnung", "beschreibung", "produkt", "artikelbezeichnung"],
  quantity: ["menge", "mge", "anzahl", "qty"],
  unit: ["einheit", "einh", "me", "unit"],
  unitPrice: ["einzelpreis", "e.-preis", "e-preis", "ep", "preis", "vk", "einzel-preis"],
  lineTotal: ["gesamtpreis", "gesamt", "ges preis", "nettowert", "summe", "betrag", "pos.-wert", "pos-wert"],
} as const;

export type ColumnRole = keyof typeof HEADER_HINTS;

export type TableColumnMap = Partial<Record<ColumnRole, number>>;

const COLUMN_ROLES = Object.keys(HEADER_HINTS) as ColumnRole[];

export function cellMatchesHeaderHint(cell: string, hint: string): boolean {
  const spaced = cell
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/[-–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const word = hint
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/[-–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!word) return false;
  const re = new RegExp(
    `(?:^|\\s)${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`,
    "i",
  );
  return re.test(spaced);
}

function bestRoleForHeaderCell(cell: string): { role: ColumnRole; hintLen: number } | null {
  let best: { role: ColumnRole; hintLen: number } | null = null;
  for (const role of COLUMN_ROLES) {
    for (const hint of HEADER_HINTS[role]) {
      if (!cellMatchesHeaderHint(cell, hint)) continue;
      if (!best || hint.length > best.hintLen) {
        best = { role, hintLen: hint.length };
      }
    }
  }
  return best;
}

/** Map clustered header cells to column roles (one role per cell, longest hint wins). */
export function mapColumnsFromHeaderCells(cells: string[]): TableColumnMap {
  const map: TableColumnMap = {};
  cells.forEach((cell, idx) => {
    const match = bestRoleForHeaderCell(cell);
    if (!match || map[match.role] !== undefined) return;
    map[match.role] = idx;
  });
  return map;
}


import type { ColumnRole } from "../table/header-map";

export type ColumnWindow = {
  role: ColumnRole;
  xMin: number;
  xMax: number;
};

export type TableTemplate = {
  layout_id: string;
  /** Column that starts a new position when it matches anchorPattern */
  anchorRole: ColumnRole;
  anchorPattern: RegExp;
  /** Full-line anchor (e.g. "00010 249706") */
  lineAnchorPattern?: RegExp;
  headerHints: Partial<Record<ColumnRole, string[]>>;
  defaultWindows: ColumnWindow[];
  /** Words with x below this go to description if unmatched */
  descriptionCatchAllMaxX?: number;
  skipLine?: RegExp;
  minY?: number;
};

export type RowCells = Partial<Record<ColumnRole, string>>;

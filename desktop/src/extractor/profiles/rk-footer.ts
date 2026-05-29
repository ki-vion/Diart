import type { PdfLine } from "../../pdf/types";
import {
  isNonItemLine as isNonItemLineBase,
  isPageImprintLine,
  isPostTableText,
} from "../table/table-zone";

export { isPostTableText, isPageImprintLine } from "../table/table-zone";

export function isRkAfterTableText(text: string): boolean {
  return isPostTableText(text);
}

export function isRkNonItemText(text: string): boolean {
  if (!text.trim()) return false;
  return isNonItemLineBase({ y: 0, text, words: [{ text, x: 0, y: 0, fontSize: 10 }] }, 842);
}

/** @deprecated Use isRkNonItemText */
export function isRkFooterText(text: string): boolean {
  return isRkNonItemText(text);
}

export function isRkFooterLine(line: PdfLine, pageHeight: number): boolean {
  return isNonItemLineBase(line, pageHeight);
}

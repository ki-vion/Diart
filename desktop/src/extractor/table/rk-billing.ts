import { parseDeNumber } from "../utils";

/** Billing units in RK ME / PE columns (not packaging lines after „= N“). */
export const RK_BILLING_UNIT_RE =
  /^(ST|M2|SA|FL|PKT|KAR|ROL|M|KG|St|Stück|Stk|kg\/Sa)$/i;

const RK_PACKAGING_UNIT_RE = /^(ST|PKT)$/i;

export const RK_EUR_PER_UNIT_RE = /EUR\s*\/\s*(?<per>[\d.,]+)\s*(?<unit>\S+)?/i;

export function isRkBillingUnit(text: string): boolean {
  return RK_BILLING_UNIT_RE.test(text.trim());
}

export function parseRkPeSuffix(text: string): {
  price_per: number | null;
  billing_unit: string | null;
} {
  const m = RK_EUR_PER_UNIT_RE.exec(text);
  if (!m?.groups) return { price_per: null, billing_unit: null };
  const per = parseDeNumber(m.groups.per ?? "");
  const rawUnit = m.groups.unit?.trim() ?? "";
  const billing_unit = rawUnit && isRkBillingUnit(rawUnit) ? rawUnit : null;
  return {
    price_per: per !== null && per > 1 ? per : null,
    billing_unit,
  };
}

export function parseRkQtyUnitLine(text: string): { quantity: number; unit: string } | null {
  const m = /^(?<qty>[\d.,]+)\s+(?<unit>\S+)$/i.exec(text.trim());
  if (!m?.groups?.qty || !m.groups.unit) return null;
  const unit = m.groups.unit.trim();
  if (!isRkBillingUnit(unit)) return null;
  const quantity = parseDeNumber(m.groups.qty);
  if (quantity === null) return null;
  return { quantity, unit };
}

/** „= 40“ + ST/PKT rows are piece counts, not billing ME. */
export function isRkPackagingUnitRow(lineText: string): boolean {
  const t = lineText.trim();
  if (/^=\s*[\d.,]+/.test(t)) return true;
  if (/\b=\s*[\d.,]+\b/.test(t) && RK_PACKAGING_UNIT_RE.test(t)) return true;
  return false;
}

export function assignRkBillingUnit(item: { unit: string | null }, unit: string): void {
  const u = unit.trim();
  if (!u) return;

  if (isRkBillingUnit(u)) {
    if (!item.unit) {
      item.unit = u;
      return;
    }
    if (RK_PACKAGING_UNIT_RE.test(item.unit) && !RK_PACKAGING_UNIT_RE.test(u)) {
      item.unit = u;
    }
    return;
  }

  if (!item.unit && RK_PACKAGING_UNIT_RE.test(u)) {
    item.unit = u;
  }
}

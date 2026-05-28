export function parseDeNumber(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/\s+/g, "");
  const noThousands = normalized.replace(/\./g, "");
  const dotDecimal = noThousands.replace(/,/g, ".");
  const v = Number(dotDecimal);

  return Number.isFinite(v) ? v : null;
}


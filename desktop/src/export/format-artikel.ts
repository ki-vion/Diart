/** True when m is a separate word (55 m²), not a suffix (1,10m width). */
const M_AS_UNIT_WORD = /\d[\d.,]*\s+m\s*$/i;

/** m²/m³ in text: only "55 m²" style or "(à … m²)", never "1,10m²". */
export const SQUARE_METER_IN_TEXT =
  /\d[\d.,]*\s+m²|\d[\d.,]*\s+m2|\(à[^)]*\d[\d.,]*\s+m²|\(à[^)]*\d[\d.,]*\s+m2/i;

/**
 * MuPDF splits "55 m²" into "55 m" + newline + "²".
 * Widths like "1,10m" stay as meters — a stray "²" line must not attach.
 */
export function normalizeUnits(cell: string): string {
  let out = cell
    .replace(/(\d[\d.,]*)\s+m\s*\n\s*²(\)?)?/g, "$1 m²$2")
    .replace(/(\d[\d.,]*)\s+m\s*\n\s*³(\)?)?/g, "$1 m³$2")
    .replace(/(\d[\d.,]*)\s+m\s+²/g, "$1 m²")
    .replace(/(\d[\d.,]*)\s+m\s+³/g, "$1 m³");

  const lines = out.split("\n");
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i] ?? "";
    const next = lines[i + 1]?.trim() ?? "";
    if (M_AS_UNIT_WORD.test(cur.trim()) && (next === "²" || next === "²)" || next.startsWith("²"))) {
      merged.push(`${cur.trimEnd()}²${next.includes(")") ? ")" : ""}`);
      i += 1;
      continue;
    }
    if (/^²\)?$/.test(cur.trim())) continue;
    merged.push(cur);
  }
  return merged.join("\n");
}

/** Einheit: PDF column often has "m" while billing is m² (see qty row in asText). */
export function formatEinheitCell(
  unit: string | null | undefined,
  description: string,
): string {
  const u = unit?.trim() ?? "";
  if (!u) return "";
  if (u === "m2") return "m²";
  if (u === "m3") return "m³";
  if (u !== "m") return u;

  const desc = normalizeUnits(description);
  if (SQUARE_METER_IN_TEXT.test(desc) || /\bm²\b|\bm2\b/i.test(desc)) {
    return "m²";
  }
  return u;
}

export type FormatArtikelOptions = {
  /** IFB/KAN PDFs label the number as „Artikelnummer: …“. */
  layoutId?: string;
};

function formatArticleNumberPart(art: string, layoutId?: string): string {
  if (layoutId === "IFB GmbH") {
    return `Artikelnummer: ${art}`;
  }
  return art;
}

/** Excel/UI column "Artikel": optional prefix, article number, multi-line description. */
export function formatArtikelCell(
  item: {
    article_number: string | null;
    artikel_prefix?: string | null;
    description: string;
  },
  options?: FormatArtikelOptions,
): string {
  const parts: string[] = [];
  const layoutId = options?.layoutId;

  const prefix = item.artikel_prefix?.trim();
  if (prefix) parts.push(prefix);

  const art = item.article_number?.trim() ?? "";
  const artLine = art ? formatArticleNumberPart(art, layoutId) : "";
  const desc = item.description?.trim() ?? "";

  if (art && desc) {
    if (desc.startsWith("(Alternativposition)")) {
      const rest = desc.slice("(Alternativposition)".length).trim();
      parts.push(
        rest ? `${artLine} (Alternativposition)\n${rest}` : `${artLine} (Alternativposition)`,
      );
    } else if (desc === art || desc === artLine) {
      parts.push(artLine);
    } else if (
      desc.startsWith(`${art}\n`) ||
      desc.startsWith(`${art} `) ||
      desc.startsWith(`${artLine}\n`) ||
      desc.startsWith(`${artLine} `)
    ) {
      parts.push(artLine);
      const rest = desc.startsWith(artLine)
        ? desc.slice(artLine.length).trim()
        : desc.slice(art.length).trim();
      if (rest) parts.push(rest);
    } else if (desc.includes(art) && !desc.includes("\n")) {
      parts.push(desc);
    } else {
      parts.push(artLine, desc);
    }
  } else if (art) {
    parts.push(artLine);
  } else if (desc) {
    parts.push(desc);
  }

  return normalizeUnits(parts.join("\n"));
}

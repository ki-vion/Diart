/** Excel/UI column "Artikel": article number + description in one cell. */
export function formatArtikelCell(item: {
  article_number: string | null;
  description: string;
}): string {
  const art = item.article_number?.trim() ?? "";
  const desc = item.description?.trim() ?? "";

  if (art && desc) {
    if (desc.includes(art)) return desc;
    return `${art} ${desc}`;
  }

  return art || desc;
}

export type PreviewRow = {
  Position: string | null;
  Artikel: string;
  Menge: number | null;
  Einheit: string | null;
  "Einzelpreis (€)": number | null;
  "Gesamt (€)": number | null;
  "Einzelpreis PDF (€)": number | null;
  Aufschlag: number;
};

export type ConvertResponse = {
  ok: boolean;
  layout_id?: string;
  message?: string;
  error?: string;
  aufschlag?: number;
  preview?: PreviewRow[];
  // Web: we return a Blob instead of a filesystem path
  xlsxBlob?: Blob;
  outputFileName?: string;
};

export async function pickAndConvert(
  _aufschlagPercent: number,
): Promise<ConvertResponse | null> {
  // Implemented in later tasks. For now return null to keep UI flow intact.
  return null;
}

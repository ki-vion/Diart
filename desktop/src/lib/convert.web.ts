import { formatArtikelCell, formatEinheitCell } from "../export/format-artikel";

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

export type PreviewTotals = {
  netto: number;
  mwst: number;
  brutto: number;
};

export type ConvertResponse = {
  ok: boolean;
  layout_id?: string;
  extraction_mode?: "layout" | "table";
  message?: string;
  error?: string;
  aufschlag?: number;
  preview?: PreviewRow[];
  previewTotals?: PreviewTotals;
  // Web: we return a Blob instead of a filesystem path
  xlsxBlob?: Blob;
  outputFileName?: string;
};

const MWST_RATE = 0.19;

function vkAndGesamt(
  item: {
    quantity: number | null;
    unit_price: number | null;
    price_per?: number | null;
  },
  aufschlag: number,
): { vk: number | null; gesamt: number | null } {
  const menge = item.quantity ?? null;
  const einzelpreisPdf = item.unit_price ?? null;
  const vk =
    menge !== null && einzelpreisPdf !== null ? einzelpreisPdf * (1 + aufschlag) : null;
  const pricePer = item.price_per ?? 1;
  const gesamt =
    menge !== null && vk !== null ? (menge * vk) / pricePer : null;
  return { vk, gesamt };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function computePreviewTotals(
  items: Parameters<typeof toPreviewRows>[0],
  aufschlag: number,
): PreviewTotals {
  const netto = round2(
    items.reduce((sum, item) => {
      const { gesamt } = vkAndGesamt(item, aufschlag);
      return sum + (gesamt ?? 0);
    }, 0),
  );
  const mwst = round2(netto * MWST_RATE);
  return { netto, mwst, brutto: round2(netto + mwst) };
}

/** Copy view bytes into a standalone ArrayBuffer (BlobPart-safe for strict DOM typings). */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toPreviewRows(
  items: Array<{
    position: string | null;
    article_number: string | null;
    artikel_prefix: string | null;
    description: string;
    quantity: number | null;
    unit: string | null;
    unit_price: number | null;
    price_per?: number | null;
  }>,
  aufschlag: number,
  layoutId?: string,
): PreviewRow[] {
  return items.slice(0, 25).map((item) => {
    const menge = item.quantity ?? null;
    const einzelpreisPdf = item.unit_price ?? null;
    const { vk, gesamt } = vkAndGesamt(item, aufschlag);

    return {
      Position: item.position,
      Artikel: formatArtikelCell(item, { layoutId }),
      Menge: menge,
      Einheit: formatEinheitCell(item.unit, item.description) || null,
      "Einzelpreis (€)": vk,
      "Gesamt (€)": gesamt,
      "Einzelpreis PDF (€)": einzelpreisPdf,
      Aufschlag: aufschlag,
    };
  });
}

export async function convertPdfFile(
  file: File,
  aufschlagPercent: number,
): Promise<ConvertResponse> {
  const aufschlag = aufschlagPercent / 100;

  try {
    const { extractPdfStructured } = await import("../pdf/structured");
    const { runExtraction } = await import("../extractor");
    const { buildExcelBuffer } = await import("../export/excel");

    const structured = await extractPdfStructured(file);
    const { detectProfile } = await import("../extractor");
    const extraction = runExtraction(structured);
    const profile = detectProfile(structured);
    const extraction_mode = profile === "generic" ? "table" : "layout";

    const xlsxBytes = await buildExcelBuffer(extraction, { aufschlag });
    const xlsxBlob = new Blob([toArrayBuffer(xlsxBytes)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const baseName = file.name.replace(/\.pdf$/i, "");
    const outputFileName = `${baseName || "output"}.xlsx`;

    return {
      ok: true,
      layout_id: extraction.layout_id,
      extraction_mode,
      message: "Konvertierung erfolgreich",
      aufschlag,
      preview: toPreviewRows(extraction.items, aufschlag, extraction.layout_id),
      previewTotals: computePreviewTotals(extraction.items, aufschlag),
      xlsxBlob,
      outputFileName,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: "Konvertierung fehlgeschlagen",
      error: msg,
      aufschlag,
    };
  }
}
import { formatArtikelCell } from "../export/format-artikel";

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
  extraction_mode?: "layout" | "table";
  message?: string;
  error?: string;
  aufschlag?: number;
  preview?: PreviewRow[];
  // Web: we return a Blob instead of a filesystem path
  xlsxBlob?: Blob;
  outputFileName?: string;
};

async function pickPdfFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.multiple = false;

    const cleanup = () => {
      input.remove();
    };

    input.addEventListener(
      "change",
      () => {
        const file = input.files?.item(0) ?? null;
        cleanup();
        resolve(file);
      },
      { once: true },
    );

    input.addEventListener(
      "cancel",
      () => {
        cleanup();
        resolve(null);
      },
      { once: true },
    );

    document.body.appendChild(input);
    input.click();
  });
}

function toPreviewRows(
  items: Array<{
    position: string | null;
    article_number: string | null;
    description: string;
    quantity: number | null;
    unit: string | null;
    unit_price: number | null;
  }>,
  aufschlag: number,
): PreviewRow[] {
  return items.slice(0, 25).map((item) => {
    const menge = item.quantity ?? null;
    const einzelpreisPdf = item.unit_price ?? null;
    const vk =
      menge !== null && einzelpreisPdf !== null ? einzelpreisPdf * (1 + aufschlag) : null;
    const gesamt = menge !== null && vk !== null ? menge * vk : null;

    return {
      Position: item.position,
      Artikel: formatArtikelCell(item),
      Menge: menge,
      Einheit: item.unit ?? null,
      "Einzelpreis PDF (€)": einzelpreisPdf,
      Aufschlag: aufschlag,
      "Einzelpreis (€)": vk,
      "Gesamt (€)": gesamt,
    };
  });
}

export async function pickAndConvert(
  aufschlagPercent: number,
): Promise<ConvertResponse | null> {
  const file = await pickPdfFile();
  if (!file) return null;

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
    const xlsxBlob = new Blob([xlsxBytes], {
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
      preview: toPreviewRows(extraction.items, aufschlag),
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

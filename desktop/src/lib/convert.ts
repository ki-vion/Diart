import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

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
  output?: string;
  message?: string;
  error?: string;
  aufschlag?: number;
  preview?: PreviewRow[];
};

export async function pickAndConvert(
  aufschlagPercent: number,
): Promise<ConvertResponse | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!selected || typeof selected !== "string") {
    return null;
  }
  const aufschlag = aufschlagPercent / 100;
  return invoke<ConvertResponse>("convert_pdf", {
    inputPath: selected,
    aufschlag,
  });
}

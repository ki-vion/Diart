/**
 * Smoke test: structured extraction + profile orchestrator on Vorlagen PDFs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMupdf } from "./lib/mupdf-node.js";
import { linesFromStructuredText } from "../src/pdf/structured-lines.js";
import { runExtraction } from "../src/extractor/orchestrator.js";
import type { PdfStructured } from "../src/pdf/types.js";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "../..");
const vorlagen = path.join(repoRoot, "Vorlagen");

function buildStructured(
  mupdf: Awaited<ReturnType<typeof loadMupdf>>,
  pdfPath: string,
): PdfStructured {
  const buf = fs.readFileSync(pdfPath);
  const doc = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf");
  try {
    const pages = [];
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i);
      try {
        const bounds = page.getBounds();
        const stext = page.toStructuredText("preserve-spans");
        const rawText = stext.asText();
        pages.push({
          index: i,
          width: bounds[2] - bounds[0],
          height: bounds[3] - bounds[1],
          lines: linesFromStructuredText(stext),
          rawText,
        });
        stext.destroy();
      } finally {
        page.destroy();
      }
    }
    return { sourceFileName: path.basename(pdfPath), pages };
  } finally {
    doc.destroy();
  }
}

async function main() {
  const pdfs = fs
    .readdirSync(vorlagen)
    .filter((n) => n.toLowerCase().endsWith(".pdf"))
    .map((n) => path.join(vorlagen, n));

  const mupdf = await loadMupdf();
  console.log("PDF | profile | items");
  console.log("--- | ------- | -----");

  for (const pdf of pdfs) {
    const structured = buildStructured(mupdf, pdf);
    const result = runExtraction(structured);
    console.log(
      `${path.basename(pdf)} | ${result.layout_id} | ${result.items.length}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

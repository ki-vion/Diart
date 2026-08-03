/**
 * Smoke test: OCR path → PdfStructured → profile extraction (FPF / econ floor).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ocrStructuredFromPdfBytes } from "../src/pdf/ocr/ocr-structured.js";
import { getOcrWorker } from "../src/pdf/ocr/tesseract-worker.js";
import { runExtraction } from "../src/extractor/orchestrator.js";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "../..");
const vorlagen = path.join(repoRoot, "Vorlagen");
const fpfName = "FPF2026234 Diart Bau und Dämmstoffe GmbH.pdf";
const fpfPath = path.join(vorlagen, fpfName);

async function smokeOcrPdf(pdfPath: string): Promise<void> {
  const bytes = new Uint8Array(fs.readFileSync(pdfPath));
  const name = path.basename(pdfPath);
  const structured = await ocrStructuredFromPdfBytes(bytes, name);
  const result = runExtraction(structured);
  console.log(`${name} | ${result.layout_id} | ${result.items.length}`);

  if (name === fpfName) {
    if (result.layout_id !== "econ floor") {
      throw new Error(`Expected profile "econ floor", got "${result.layout_id}"`);
    }
    if (result.items.length < 1) {
      throw new Error(`Expected >= 1 item from FPF OCR extract, got ${result.items.length}`);
    }
    if (result.items.length < 5) {
      console.warn(`WARN: FPF items=${result.items.length} (prefer >= 5)`);
    }
  }
}

async function main() {
  if (!fs.existsSync(fpfPath)) {
    throw new Error(`Missing FPF sample: ${fpfPath}`);
  }

  console.log("PDF | profile | items");
  console.log("--- | ------- | -----");
  await smokeOcrPdf(fpfPath);
  await (await getOcrWorker()).terminate();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

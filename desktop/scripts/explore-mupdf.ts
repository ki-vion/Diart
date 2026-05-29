import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStructuredFromPdf } from "./lib/build-structured.js";
import { dumpPage, wordsToTsv } from "./lib/dump-structured.js";
import { cellsToTsv, linesToTsv } from "./lib/lines-to-tsv.js";
import { loadMupdf } from "./lib/mupdf-node.js";
import { detectProfile } from "../src/extractor/profiles/detect-profile.js";
import { calibrateColumnWindows, lineToCells, trimCells } from "../src/extractor/pipeline/columns.js";
import { NORIT_TEMPLATE, RK_STARK_TEMPLATE } from "../src/extractor/pipeline/templates.js";
import type { PdfProfile } from "../src/extractor/profiles/types.js";
import type { TableTemplate } from "../src/extractor/pipeline/types.js";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(scriptsDir, "..");
const repoRoot = path.resolve(desktopDir, "..");
const defaultVorlagen = path.join(repoRoot, "Vorlagen");
const outRoot = path.join(desktopDir, "exploration-output");

function safeName(p: string): string {
  return path.basename(p).replace(/[^\w.-]+/g, "_");
}

function templateForProfile(profile: PdfProfile): TableTemplate | null {
  switch (profile) {
    case "rk_stark":
      return RK_STARK_TEMPLATE;
    case "norit_rechnung":
      return NORIT_TEMPLATE;
    default:
      return null;
  }
}

function collectPdfs(input: string): string[] {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Path not found: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    return fs
      .readdirSync(resolved)
      .filter((n) => n.toLowerCase().endsWith(".pdf"))
      .map((n) => path.join(resolved, n));
  }
  return [resolved];
}

async function explorePdf(
  mupdf: Awaited<ReturnType<typeof loadMupdf>>,
  pdfPath: string,
) {
  const buf = fs.readFileSync(pdfPath);
  const doc = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf");
  const outDir = path.join(outRoot, safeName(pdfPath));
  fs.mkdirSync(outDir, { recursive: true });

  const summary: {
    pdf: string;
    pageCount: number;
    pages: Array<{
      index: number;
      width: number;
      height: number;
      lineCount: number;
      wordCount: number;
    }>;
  } = {
    pdf: pdfPath,
    pageCount: doc.countPages(),
    pages: [],
  };

  try {
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i);
      try {
        const dump = dumpPage(i, page);
        const prefix = path.join(outDir, `page-${String(i).padStart(2, "0")}`);
        fs.writeFileSync(`${prefix}-asText.txt`, dump.asText, "utf8");
        fs.writeFileSync(`${prefix}-asJSON.json`, dump.asJson, "utf8");
        fs.writeFileSync(`${prefix}-words.tsv`, wordsToTsv(dump.words), "utf8");

        summary.pages.push({
          index: i,
          width: dump.width,
          height: dump.height,
          lineCount: dump.asText.split(/\r?\n/).filter((l) => l.trim()).length,
          wordCount: dump.words.length,
        });
      } finally {
        page.destroy();
      }
    }
  } finally {
    doc.destroy();
  }

  fs.writeFileSync(
    path.join(outDir, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );

  const structured = buildStructuredFromPdf(mupdf, pdfPath);
  const profile = detectProfile(structured);
  const template = templateForProfile(profile);
  const profileMeta: Record<string, unknown> = { profile };

  if (template) {
    const windows = calibrateColumnWindows(
      structured.pages,
      template.headerHints,
      template.defaultWindows,
    );
    profileMeta.columnWindows = windows;
    profileMeta.columnWindowsHint =
      "Spaltenfenster in PDF-Punkten (x). Werte aus Header kalibriert oder defaultWindows in pipeline/templates.ts";

    const catchAll = template.descriptionCatchAllMaxX ?? 320;
    const assign = (line: (typeof structured.pages)[0]["lines"][0]) =>
      trimCells(lineToCells(line, windows, catchAll));

    for (const page of structured.pages) {
      const prefix = path.join(outDir, `page-${String(page.index).padStart(2, "0")}`);
      fs.writeFileSync(`${prefix}-lines.tsv`, linesToTsv(page.lines), "utf8");
      fs.writeFileSync(
        `${prefix}-cells.tsv`,
        cellsToTsv(page.lines, (l) => assign(l) as Record<string, string>),
        "utf8",
      );
    }
  } else {
    for (const page of structured.pages) {
      const prefix = path.join(outDir, `page-${String(page.index).padStart(2, "0")}`);
      fs.writeFileSync(`${prefix}-lines.tsv`, linesToTsv(page.lines), "utf8");
    }
  }

  fs.writeFileSync(
    path.join(outDir, "profile.json"),
    JSON.stringify(profileMeta, null, 2),
    "utf8",
  );

  console.log(`Wrote ${outDir} (${summary.pageCount} pages, profile=${profile})`);
}

async function main() {
  const args = process.argv.slice(2);
  const inputs: string[] = [];

  if (args.length === 0) {
    if (!fs.existsSync(defaultVorlagen)) {
      console.error(`No args and Vorlagen not found: ${defaultVorlagen}`);
      process.exit(1);
    }
    inputs.push(defaultVorlagen);
  } else {
    for (const a of args) inputs.push(a);
  }

  const pdfs: string[] = [];
  for (const input of inputs) {
    pdfs.push(...collectPdfs(input));
  }

  if (pdfs.length === 0) {
    console.error("No PDF files found.");
    process.exit(1);
  }

  console.log(`Exploring ${pdfs.length} PDF(s)...`);
  const mupdf = await loadMupdf();
  for (const pdf of pdfs) {
    console.log(`\n→ ${pdf}`);
    await explorePdf(mupdf, pdf);
  }
  console.log(`\nDone. Output under ${outRoot}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Dump profile, X column windows, per-line cell assignment, and parsed items.
 * Output: desktop/exploration-output/<pdf>/blocks.json (+ cells/lines TSVs per page)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStructuredFromPdf } from "./lib/build-structured.js";
import { explorePipelineInfo, structuredLinesWithFlagsToTsv } from "./lib/explore-extraction.js";
import { cellsToTsv } from "./lib/lines-to-tsv.js";
import { loadMupdf } from "./lib/mupdf-node.js";
import { detectProfile } from "../src/extractor/profiles/detect-profile.js";
import { extractByProfile } from "../src/extractor/profiles/index.js";
import { calibrateColumnWindows, lineToCells, trimCells } from "../src/extractor/pipeline/columns.js";
import { NORIT_TEMPLATE, RK_STARK_TEMPLATE } from "../src/extractor/pipeline/templates.js";
import type { PdfLine } from "../src/pdf/types.js";
import type { PdfProfile } from "../src/extractor/profiles/types.js";
import type { TableTemplate } from "../src/extractor/pipeline/types.js";
import { noritLineToCells } from "../src/extractor/table/norit-structured.js";
import {
  exploreLineFlags,
  getPageTableMeta,
  serializeTableRegion,
} from "../src/extractor/table/line-meta.js";

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
    case "RAAB Karcher":
      return RK_STARK_TEMPLATE;
    case "Norit":
      return NORIT_TEMPLATE;
    default:
      return null;
  }
}

function collectPdfs(input: string): string[] {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) throw new Error(`Path not found: ${resolved}`);
  if (fs.statSync(resolved).isDirectory()) {
    return fs
      .readdirSync(resolved)
      .filter((n) => n.toLowerCase().endsWith(".pdf"))
      .map((n) => path.join(resolved, n));
  }
  return [resolved];
}

async function exploreBlocks(mupdf: Awaited<ReturnType<typeof loadMupdf>>, pdfPath: string) {
  const structured = buildStructuredFromPdf(mupdf, pdfPath);
  const source = structured.sourceFileName ?? path.basename(pdfPath);
  const profile = detectProfile(structured);
  const pipelineInfo = explorePipelineInfo(profile);
  const extraction = extractByProfile(structured, profile, source);

  const template = templateForProfile(profile);
  const windows = template
    ? calibrateColumnWindows(
        structured.pages,
        template.headerHints,
        template.defaultWindows,
        template.layout_id,
      )
    : null;

  const catchAll = template?.descriptionCatchAllMaxX ?? 320;
  const assignCells = (line: PdfLine) => {
    if (!windows) return {};
    if (profile === "Norit") {
      return noritLineToCells(line, windows) as Record<string, string>;
    }
    return trimCells(lineToCells(line, windows, catchAll)) as Record<string, string>;
  };

  const pagesOut = structured.pages.map((page) => {
    const tableMeta = getPageTableMeta(page);
    const linesOut = page.lines.map((line, lineIndex) => {
      const cells = assignCells(line);
      const xs = line.words.map((w) => w.x);
      const flags = exploreLineFlags(page, lineIndex, tableMeta);
      return {
        lineIndex,
        y: Math.round(line.y * 100) / 100,
        text: line.text,
        xMin: xs.length ? Math.min(...xs) : null,
        xMax: xs.length ? Math.max(...xs) : null,
        cells,
        inTableRegion: flags.inTableRegion,
        isNonItem: flags.isNonItem,
        isAnchor: flags.isAnchor,
        anchorKind: flags.anchorKind,
      };
    });

    return {
      index: page.index,
      width: page.width,
      height: page.height,
      tableRegion: serializeTableRegion(tableMeta.region),
      anchorCount: tableMeta.anchors.length,
      lines: linesOut,
    };
  });

  const outDir = path.join(outRoot, safeName(pdfPath));
  fs.mkdirSync(outDir, { recursive: true });

  const report: Record<string, unknown> = {
    pdf: pdfPath,
    profile,
    extractionSource: pipelineInfo.extractionSource,
    anchorSource: pipelineInfo.anchorSource,
    layout_id: extraction.layout_id,
    itemCount: extraction.items.length,
    items: extraction.items,
    pages: pagesOut,
  };

  if (windows) {
    report.columnWindows = windows;
    report.columnWindowsSource =
      windows === template?.defaultWindows ? "default" : "calibrated-from-header";
  }

  fs.writeFileSync(path.join(outDir, "blocks.json"), JSON.stringify(report, null, 2), "utf8");

  if (windows) {
    for (const page of structured.pages) {
      const prefix = path.join(outDir, `page-${String(page.index).padStart(2, "0")}`);
      fs.writeFileSync(`${prefix}-cells.tsv`, cellsToTsv(page.lines, assignCells), "utf8");
      const tableMeta = getPageTableMeta(page);
      const lineFlags = page.lines.map((_, i) => exploreLineFlags(page, i, tableMeta));
      fs.writeFileSync(
        `${prefix}-lines.tsv`,
        structuredLinesWithFlagsToTsv(page.lines, lineFlags),
        "utf8",
      );
    }
  }

  console.log(`Wrote ${outDir}/blocks.json (${extraction.items.length} items, profile=${profile})`);
  if (windows) {
    console.log(`  + page-XX-cells.tsv, page-XX-lines.tsv (header-calibrated X columns)`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const inputs = args.length === 0 ? [defaultVorlagen] : args;
  const pdfs: string[] = [];
  for (const input of inputs) pdfs.push(...collectPdfs(input));

  const mupdf = await loadMupdf();
  console.log(`Block debug for ${pdfs.length} PDF(s)...`);
  for (const pdf of pdfs) {
    console.log(`\n→ ${pdf}`);
    await exploreBlocks(mupdf, pdf);
  }
  console.log(`\nDone. See ${outRoot}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

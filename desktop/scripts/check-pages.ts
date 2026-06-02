import { loadMupdf } from "./lib/mupdf-node.js";
import { buildStructuredFromPdf } from "./lib/build-structured.js";
import { findTableRegion, findTableRegionOrContinuation } from "../src/extractor/table/table-region.js";
import { findBlockAnchors } from "../src/extractor/table/item-blocks.js";
import { extractAnchoredItems } from "../src/extractor/table/anchor-extract.js";

const pdf = process.argv[2] ?? "../Vorlagen/1006408813_DIART_BAU_NEU_.pdf";
const mupdf = await loadMupdf();
const s = buildStructuredFromPdf(mupdf, pdf);

for (const p of s.pages) {
  const full = findTableRegion(p);
  const region = findTableRegionOrContinuation(p);
  const anchors = region
    ? findBlockAnchors(p.lines, region.dataStartIndex).filter(
        (a) => a.lineIndex < region.dataEndIndex,
      )
    : [];
  console.log(
    `page ${p.index}: full=${full ? [full.dataStartIndex, full.dataEndIndex] : null} cont=${region ? [region.dataStartIndex, region.dataEndIndex] : null} anchors=${anchors.length}`,
    anchors.slice(0, 4).map((a) => p.lines[a.lineIndex]?.text),
  );
}

const items = extractAnchoredItems(s, "RAAB Karcher");
console.log(`\n${items.length} items:`, items.map((i) => i.position).join(", "));

import type { FlatTextLine, NoritLineExplore } from "../../src/extractor/profiles/explore-norit.js";
import type { ExploreLineFlags } from "../../extractor/table/line-meta.js";
import type { PdfLine } from "../../pdf/types.js";
import type { PdfProfile } from "../../extractor/profiles/types.js";

export type ExplorePipelineInfo = {
  profile: PdfProfile;
  extractionSource: string;
  anchorSource: string;
  usesXColumnCells: boolean;
};

export function explorePipelineInfo(profile: PdfProfile): ExplorePipelineInfo {
  switch (profile) {
    case "Norit":
      return {
        profile,
        extractionSource:
          "header-calibrated X columns → noritLineToCells → pair Artikel+Menge rows (same as extractNorit / Excel upload)",
        anchorSource: "position column fragment (3-digit) with price/qty context",
        usesXColumnCells: true,
      };
    case "RAAB Karcher":
      return {
        profile,
        extractionSource:
          "extractAnchoredItems + parseColumnItemBlock (calibrated X columns) → fallback extractWithTemplate",
        anchorSource: "findBlockAnchors within table data region",
        usesXColumnCells: true,
      };
    case "IFB GmbH":
      return {
        profile,
        extractionSource:
          "extractAnchoredItems → fallback kan_ifb line parser (flat asText)",
        anchorSource: "findBlockAnchors (kan) within table data region",
        usesXColumnCells: false,
      };
    case "Rudolf Laier GmbH":
      return {
        profile,
        extractionSource: "extractAnchoredItems → fallback laier_van line parser",
        anchorSource: "findBlockAnchors (laier) within table data region",
        usesXColumnCells: false,
      };
    case "Bauwaren Mahler":
      return {
        profile,
        extractionSource: "findTableRegion → Mahler position anchors (N,N) → multi-line blocks",
        anchorSource: "comma position in first column + article number in next lines",
        usesXColumnCells: true,
      };
    default:
      return {
        profile,
        extractionSource: "findTableRegion → generic position anchors → multi/single-line rows",
        anchorSource: "1–8 digit position in first column after header row",
        usesXColumnCells: false,
      };
  }
}

export function noritParserLinesToTsv(lines: NoritLineExplore[]): string {
  const header = "globalIndex\tpage\ttext\tisAnchor\tblockIndex\troleInBlock";
  const rows = lines.map((l) =>
    [
      l.globalIndex,
      l.pageIndex,
      l.text.replace(/\t/g, " "),
      l.isAnchor ? "1" : "0",
      l.blockIndex ?? "",
      l.roleInBlock ?? "",
    ].join("\t"),
  );
  return [header, ...rows].join("\n");
}

export function flatTextLinesToTsv(lines: FlatTextLine[]): string {
  const header = "globalIndex\tpage\ttext";
  const rows = lines.map((l) =>
    [l.globalIndex, l.pageIndex, l.text.replace(/\t/g, " ")].join("\t"),
  );
  return [header, ...rows].join("\n");
}

export function noritPageParserToTsv(lines: NoritLineExplore[], pageIndex: number): string {
  return noritParserLinesToTsv(lines.filter((l) => l.pageIndex === pageIndex));
}

export function structuredLinesWithFlagsToTsv(
  lines: PdfLine[],
  flags: ExploreLineFlags[],
): string {
  const header = "y\ttext\txMin\txMax\twordCount\tinTable\tisNonItem\tisAnchor\tanchorKind";
  const rows = lines.map((line, i) => {
    const f = flags[i]!;
    const xs = line.words.map((w) => w.x);
    const xMin = xs.length ? Math.min(...xs).toFixed(2) : "";
    const xMax = xs.length ? Math.max(...xs).toFixed(2) : "";
    return [
      line.y.toFixed(2),
      line.text.replace(/\t/g, " "),
      xMin,
      xMax,
      line.words.length,
      f.inTableRegion ? "1" : "0",
      f.isNonItem ? "1" : "0",
      f.isAnchor ? "1" : "0",
      f.anchorKind ?? "",
    ].join("\t");
  });
  return [header, ...rows].join("\n");
}

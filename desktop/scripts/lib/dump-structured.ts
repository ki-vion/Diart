import type { MupdfModule } from "./mupdf-node.js";
import type { DumpWord, PageDump } from "./types.js";

export function dumpPage(
  pageIndex: number,
  page: InstanceType<MupdfModule["Page"]>,
): PageDump {
  const bounds = page.getBounds();
  const width = bounds[2] - bounds[0];
  const height = bounds[3] - bounds[1];

  const stext = page.toStructuredText();
  const asText = stext.asText();
  const asJson = stext.asJSON(1.0);

  const words: DumpWord[] = [];
  stext.walk({
    onChar(c, origin, _font, size) {
      if (!c.trim()) return;
      words.push({
        page: pageIndex,
        char: c,
        x: origin[0],
        y: origin[1],
        fontSize: size,
      });
    },
  });

  stext.destroy();

  return { pageIndex, width, height, asText, asJson, words };
}

export function wordsToTsv(words: DumpWord[]): string {
  const header = "page\tchar\tx\ty\tfontSize";
  const rows = words.map(
    (w) =>
      `${w.page}\t${w.char}\t${w.x.toFixed(2)}\t${w.y.toFixed(2)}\t${w.fontSize.toFixed(2)}`,
  );
  return [header, ...rows].join("\n");
}

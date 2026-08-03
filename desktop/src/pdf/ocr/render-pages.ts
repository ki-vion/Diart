import { getMupdf } from "../mupdf-loader";
import type { PageRenderMeta } from "./types";

export type RenderedPage = { png: Uint8Array; meta: PageRenderMeta };

export async function renderPdfPages(
  file: File,
  dpi = 144,
): Promise<RenderedPage[]> {
  const mupdf = await getMupdf();
  const scale = dpi / 72;
  const buf = await file.arrayBuffer();
  const doc = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf");
  try {
    const out: RenderedPage[] = [];
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i);
      try {
        const bounds = page.getBounds();
        const widthPt = bounds[2] - bounds[0];
        const heightPt = bounds[3] - bounds[1];
        const pixmap = page.toPixmap(
          mupdf.Matrix.scale(scale, scale),
          mupdf.ColorSpace.DeviceRGB,
          false,
          true,
        );
        try {
          const png = pixmap.asPNG();
          out.push({
            png: png instanceof Uint8Array ? png : new Uint8Array(png),
            meta: { pageIndex: i, widthPt, heightPt, scale },
          });
        } finally {
          pixmap.destroy();
        }
      } finally {
        page.destroy();
      }
    }
    return out;
  } finally {
    doc.destroy();
  }
}

import { getMupdf } from "../mupdf-loader";
import type { PageRenderMeta } from "./types";

export type RenderedPage = { png: Uint8Array; meta: PageRenderMeta };

function renderPageAtIndex(
  mupdf: Awaited<ReturnType<typeof getMupdf>>,
  doc: ReturnType<Awaited<ReturnType<typeof getMupdf>>["Document"]["openDocument"]>,
  pageIndex: number,
  scale: number,
): RenderedPage {
  const page = doc.loadPage(pageIndex);
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
      return {
        png: png instanceof Uint8Array ? png : new Uint8Array(png),
        meta: { pageIndex, widthPt, heightPt, scale },
      };
    } finally {
      pixmap.destroy();
    }
  } finally {
    page.destroy();
  }
}

export async function forEachRenderedPdfPage(
  file: File,
  dpi: number,
  onPage: (page: RenderedPage) => Promise<void>,
): Promise<void> {
  const mupdf = await getMupdf();
  const scale = dpi / 72;
  const buf = await file.arrayBuffer();
  const doc = mupdf.Document.openDocument(new Uint8Array(buf), "application/pdf");
  try {
    for (let i = 0; i < doc.countPages(); i++) {
      const rendered = renderPageAtIndex(mupdf, doc, i, scale);
      await onPage(rendered);
    }
  } finally {
    doc.destroy();
  }
}

export async function renderPdfPages(
  file: File,
  dpi = 144,
): Promise<RenderedPage[]> {
  const out: RenderedPage[] = [];
  await forEachRenderedPdfPage(file, dpi, async (page) => {
    out.push(page);
  });
  return out;
}

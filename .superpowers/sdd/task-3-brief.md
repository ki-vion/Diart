### Task 3: Render PDF pages to PNG via MuPDF

**Files:**
- Create: `desktop/src/pdf/ocr/render-pages.ts`
- Test: `desktop/src/pdf/ocr/render-pages.test.ts` (optional light mock â€” prefer smoke in Task 8; here add a tiny unit that documents the public type if mocking MuPDF is heavy)

**Interfaces:**
- Consumes: `getMupdf()` from `desktop/src/pdf/mupdf-loader.ts`; `PageRenderMeta`
- Produces:
  - `export type RenderedPage = { png: Uint8Array; meta: PageRenderMeta }`
  - `export async function renderPdfPages(file: File, dpi?: number): Promise<RenderedPage[]>`
  - Default `dpi = 144`

Implementation sketch:

```ts
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
```

- [ ] **Step 1: Implement `render-pages.ts` as above**

- [ ] **Step 2: Quick Node sanity (optional but recommended)**

From `desktop/` using existing `loadMupdf` pattern, or defer full check to Task 8. If easy: small `tsx` one-liner that renders FPF page 0 and asserts `png.byteLength > 1000`.

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pdf/ocr/render-pages.ts
git commit -m "$(cat <<'EOF'
feat: render PDF pages to PNG for OCR

EOF
)"
```

---

export type OcrWordBox = {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type PageRenderMeta = {
  pageIndex: number;
  widthPt: number;
  heightPt: number;
  scale: number;
};

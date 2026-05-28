export type PdfText = {
  sourceFileName?: string;
  pages: { index: number; lines: string[] }[];
};


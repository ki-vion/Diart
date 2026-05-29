export type PdfText = {
  sourceFileName?: string;
  pages: { index: number; lines: string[] }[];
};

export type PdfWord = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
};

export type PdfLine = {
  y: number;
  words: PdfWord[];
  text: string;
};

export type PdfPageStructured = {
  index: number;
  width: number;
  height: number;
  lines: PdfLine[];
  rawText: string;
};

export type PdfStructured = {
  sourceFileName?: string;
  pages: PdfPageStructured[];
};

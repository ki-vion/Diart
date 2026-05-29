export type DumpWord = {
  page: number;
  char: string;
  x: number;
  y: number;
  fontSize: number;
};

export type PageDump = {
  pageIndex: number;
  width: number;
  height: number;
  asText: string;
  asJson: string;
  words: DumpWord[];
};

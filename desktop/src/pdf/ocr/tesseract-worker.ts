import { createWorker, type Worker } from "tesseract.js";
import type { OcrWordBox } from "./types";

let workerPromise: Promise<Worker> | null = null;

async function createOcrWorker(): Promise<Worker> {
  if (typeof window !== "undefined") {
    return createWorker("deu+eng", 1, {
      workerPath: "/tesseract/worker.min.js",
      corePath: "/tesseract/",
      langPath: "/tesseract",
      gzip: false,
    });
  }
  const { fileURLToPath } = await import("node:url");
  const langPath = fileURLToPath(
    new URL("../../../public/tesseract", import.meta.url),
  );
  return createWorker("deu+eng", 1, { langPath, gzip: false });
}

export async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createOcrWorker();
  }
  return workerPromise;
}

export async function recognizePng(png: Uint8Array): Promise<OcrWordBox[]> {
  const worker = await getOcrWorker();
  const image =
    typeof window !== "undefined"
      ? new Blob([png], { type: "image/png" })
      : Buffer.from(png);
  const result = await worker.recognize(image);
  return (result.data.words ?? [])
    .filter((w) => w.text?.trim())
    .map((w) => ({
      text: w.text.trim(),
      x0: w.bbox.x0,
      y0: w.bbox.y0,
      x1: w.bbox.x1,
      y1: w.bbox.y1,
    }));
}

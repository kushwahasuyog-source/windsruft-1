import fs from 'node:fs/promises';
import path from 'node:path';
import { createWorker } from 'tesseract.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { AppError } from '../../errors';
import { rasterizePdf } from '../image/rasterize';
import { pageInfo } from '../pdf/engine';

export const ocrLanguages = ['eng', 'spa', 'fra', 'deu', 'ita', 'por', 'hin', 'ara', 'chi_sim', 'jpn'] as const;
const latinLanguages = new Set<string>(['eng', 'spa', 'fra', 'deu', 'ita', 'por']);
export type OcrLanguage = typeof ocrLanguages[number];
export interface OcrOptions { language: OcrLanguage; dpi: number; }
export interface OcrResult { pdfPath?: string; textPath: string; characterCount: number; unicodeFontConfigured: boolean; }

type OcrWord = { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } };
type OcrData = { text: string; words?: OcrWord[] };

export async function runOcr(input: string, workspace: string, options: OcrOptions): Promise<OcrResult> {
  const langPath = process.env.OCR_LANG_PATH;
  if (!langPath) throw new AppError('ENGINE_UNAVAILABLE', 503, 'OCR language data is not configured on this deployment.');
  const rasterDirectory = path.join(workspace, 'ocr-raster');
  const info = await pageInfo(input);
  const pages = await rasterizePdf(input, rasterDirectory, { pages: Array.from({ length: info.pages }, (_value, index) => index + 1), dpi: options.dpi, format: 'png' });
  let worker;
  try {
    worker = await createWorker(options.language, 1, { langPath, cachePath: langPath });
  } catch {
    throw new AppError('ENGINE_UNAVAILABLE', 503, 'OCR language data could not be loaded on this deployment.');
  }
  const document = await PDFDocument.load(await fs.readFile(input));
  const fontPath = process.env.OCR_UNICODE_FONT_PATH;
  const unicodeFontConfigured = Boolean(fontPath);
  const canOverlay = unicodeFontConfigured || latinLanguages.has(options.language);
  const font = fontPath ? await document.embedFont(await fs.readFile(fontPath)) : await document.embedFont(StandardFonts.Helvetica);
  const texts: string[] = [];
  try {
    for (const raster of pages) {
      const result = await worker.recognize(raster.path, {}, { text: true });
      const data = result.data as unknown as OcrData;
      texts.push(data.text);
      if (canOverlay && data.words) {
        const page = document.getPages()[raster.page - 1];
        const scaleX = page.getWidth() / raster.width;
        const scaleY = page.getHeight() / raster.height;
        data.words.filter((word) => word.text.trim()).forEach((word) => {
          const text = unicodeFontConfigured ? word.text : word.text.replace(/[^\u0020-\u00ff]/g, '');
          if (!text.trim()) return;
          page.drawText(text, {
            x: word.bbox.x0 * scaleX,
            y: page.getHeight() - word.bbox.y1 * scaleY,
            size: Math.max(4, (word.bbox.y1 - word.bbox.y0) * scaleY),
            font,
            color: rgb(0, 0, 0),
            opacity: 0,
          });
        });
      }
    }
  } finally {
    await worker.terminate();
  }
  const textPath = path.join(workspace, 'ocr.txt');
  await fs.writeFile(textPath, texts.join('\n\n'));
  if (!canOverlay) {
    return { textPath, characterCount: texts.join('').length, unicodeFontConfigured: false };
  }
  const pdfPath = path.join(workspace, 'ocr.pdf');
  await fs.writeFile(pdfPath, await document.save());
  return { pdfPath, textPath, characterCount: texts.join('').length, unicodeFontConfigured };
}

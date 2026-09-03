import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { AppError } from '../../errors';

const run = promisify(execFile);

export type RasterFormat = 'png' | 'jpg' | 'webp';
export interface RasterizeOptions {
  pages?: number[];
  dpi?: number;
  format: RasterFormat;
  quality?: number;
}

export interface RasterPage {
  page: number;
  path: string;
  width: number;
  height: number;
}

function validatePages(pages: number[] | undefined): number[] | undefined {
  if (!pages) return undefined;
  if (!pages.length || pages.some((page) => !Number.isInteger(page) || page < 1)) {
    throw new AppError('PROCESSING_FAILED', 400, 'Pages must be positive 1-based numbers.');
  }
  return [...new Set(pages)];
}

async function rasterizePage(input: string, outputDirectory: string, page: number, dpi: number): Promise<string> {
  const prefix = path.join(outputDirectory, `source-${page}`);
  try {
    await run(process.env.PDFTOPPM_PATH || 'pdftoppm', [
      '-f', String(page), '-l', String(page), '-r', String(dpi), '-png', '-singlefile', input, prefix,
    ], { timeout: 120_000 });
  } catch (error) {
    const details = error as { code?: string };
    if (details.code !== 'ENOENT') throw new AppError('PROCESSING_FAILED', 422, 'The PDF page could not be rendered.');
    try {
      await run(process.env.GHOSTSCRIPT_PATH || 'gs', [
        '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=png16m',
        `-r${dpi}`, `-dFirstPage=${page}`, `-dLastPage=${page}`,
        `-sOutputFile=${prefix}.png`, input,
      ], { timeout: 120_000 });
    } catch (fallbackError) {
      const fallbackDetails = fallbackError as { code?: string };
      if (fallbackDetails.code === 'ENOENT') throw new AppError('ENGINE_UNAVAILABLE', 503, 'The image rendering engine is unavailable.');
      throw new AppError('PROCESSING_FAILED', 422, 'The PDF page could not be rendered.');
    }
  }
  return `${prefix}.png`;
}

export async function rasterizePdf(input: string, outputDirectory: string, options: RasterizeOptions): Promise<RasterPage[]> {
  const dpi = Math.min(600, Math.max(36, Math.round(options.dpi ?? 150)));
  const pages = validatePages(options.pages) ?? [1];
  await fs.mkdir(outputDirectory, { recursive: true });
  const results: RasterPage[] = [];
  for (const page of pages) {
    const source = await rasterizePage(input, outputDirectory, page, dpi);
    const output = path.join(outputDirectory, `page-${page}.${options.format}`);
    let pipeline = sharp(source).removeAlpha();
    const quality = Math.min(100, Math.max(1, Math.round(options.quality ?? 85)));
    if (options.format === 'jpg') pipeline = pipeline.jpeg({ quality });
    if (options.format === 'webp') pipeline = pipeline.webp({ quality });
    if (options.format === 'png') pipeline = pipeline.png({ quality });
    const metadata = await pipeline.toFile(output);
    results.push({ page, path: output, width: metadata.width ?? 0, height: metadata.height ?? 0 });
    await fs.rm(source, { force: true });
  }
  return results;
}

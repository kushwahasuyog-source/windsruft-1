import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { degrees, PDFDocument } from 'pdf-lib';
import { AppError } from '../../errors';

const run = promisify(execFile);
export type CompressionLevel = 'low' | 'recommended' | 'high';
const settings: Record<CompressionLevel, string> = {
  low: '/prepress',
  recommended: '/ebook',
  high: '/screen',
};

export interface CompressionEngine {
  compress(input: string, output: string, level: CompressionLevel): Promise<'ghostscript' | 'pdf-lib'>;
}

export const compressionEngine: CompressionEngine = {
  async compress(input, output, level) {
    try {
      await run(
        process.env.GHOSTSCRIPT_PATH || 'gs',
        [
          '-sDEVICE=pdfwrite',
          '-dCompatibilityLevel=1.5',
          `-dPDFSETTINGS=${settings[level]}`,
          '-dNOPAUSE',
          '-dBATCH',
          '-dQUIET',
          `-sOutputFile=${output}`,
          input,
        ],
        { timeout: 120_000 },
      );
      return 'ghostscript';
    } catch {
      try {
        const document = await loadPdf(input);
        document.setTitle('');
        document.setAuthor('');
        document.setSubject('');
        await fs.writeFile(output, await document.save({ useObjectStreams: true }));
        return 'pdf-lib';
      } catch {
        throw new AppError('CORRUPT_PDF', 422, 'The PDF appears to be corrupted.');
      }
    }
  },
};

export async function loadPdf(filename: string): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(await fs.readFile(filename), { ignoreEncryption: false });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('encrypt') || message.includes('password')) {
      throw new AppError('PASSWORD_REQUIRED', 422, 'This PDF requires a password.');
    }
    throw new AppError('CORRUPT_PDF', 422, 'The PDF appears to be corrupted.');
  }
}

export async function compressPdf(
  input: string,
  output: string,
  level: CompressionLevel,
): Promise<{ engine: string; originalSize: number; compressedSize: number; savedPercent: number }> {
  await loadPdf(input);
  const engine = await compressionEngine.compress(input, output, level);
  const originalSize = (await fs.stat(input)).size;
  const compressedSize = (await fs.stat(output)).size;
  if (compressedSize >= originalSize) {
    await fs.copyFile(input, output);
    return { engine, originalSize, compressedSize: originalSize, savedPercent: 0 };
  }
  return {
    engine,
    originalSize,
    compressedSize,
    savedPercent: Math.round((1 - compressedSize / originalSize) * 100),
  };
}

export async function mergePdfs(inputs: string[], output: string): Promise<void> {
  const merged = await PDFDocument.create();
  for (const input of inputs) {
    const source = await loadPdf(input);
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  await fs.writeFile(output, await merged.save());
}

export async function rotatePdf(
  input: string,
  output: string,
  selectedPages: number[],
  angle: number,
): Promise<void> {
  const document = await loadPdf(input);
  const pages = document.getPages();
  const selected = new Set(selectedPages.length ? selectedPages : pages.map((_page, index) => index));
  pages.forEach((page, index) => {
    if (selected.has(index)) page.setRotation(degrees((page.getRotation().angle + angle) % 360));
  });
  await fs.writeFile(output, await document.save());
}

export async function pageInfo(input: string): Promise<{
  pages: number;
  sizes: Array<{ width: number; height: number }>;
  metadata: { title: string | undefined; author: string | undefined; subject: string | undefined };
}> {
  const document = await loadPdf(input);
  return {
    pages: document.getPageCount(),
    sizes: document.getPages().map((page) => ({ width: page.getWidth(), height: page.getHeight() })),
    metadata: { title: document.getTitle(), author: document.getAuthor(), subject: document.getSubject() },
  };
}

export async function splitPdf(
  input: string,
  groups: number[][],
  workspace: string,
): Promise<Array<{ id: string; name: string; path: string }>> {
  const source = await loadPdf(input);
  const files: Array<{ id: string; name: string; path: string }> = [];
  for (let index = 0; index < groups.length; index += 1) {
    const output = await PDFDocument.create();
    const pages = await output.copyPages(source, groups[index]);
    pages.forEach((page) => output.addPage(page));
    const id = crypto.randomUUID();
    const filename = path.join(workspace, id);
    await fs.writeFile(filename, await output.save());
    files.push({ id, name: `split-${index + 1}.pdf`, path: filename });
  }
  return files;
}

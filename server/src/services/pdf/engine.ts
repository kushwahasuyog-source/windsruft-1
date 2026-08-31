import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { AppError } from '../../errors';

const run = promisify(execFile);
export type CompressionLevel = 'low' | 'recommended' | 'high';
const settings: Record<CompressionLevel, string> = {
  low: '/printer',
  recommended: '/ebook',
  high: '/screen',
};

const downsampling: Record<CompressionLevel, string[]> = {
  low: [
    '-dDownsampleColorImages=true',
    '-dColorImageResolution=180',
    '-dDownsampleGrayImages=true',
    '-dGrayImageResolution=180',
    '-dDownsampleMonoImages=true',
    '-dMonoImageResolution=180',
  ],
  recommended: [],
  high: [
    '-dAutoFilterColorImages=false',
    '-dColorImageFilter=/DCTEncode',
    '-dJPEGQ=40',
  ],
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
          '-dDetectDuplicateImages=true',
          `-dPDFSETTINGS=${settings[level]}`,
          ...downsampling[level],
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

export async function mergePdfs(inputs: string[], output: string, rotations: number[] = []): Promise<void> {
  const merged = await PDFDocument.create();
  for (const input of inputs) {
    const source = await loadPdf(input);
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => {
      const sourceIndex = pages.indexOf(page);
      if (rotations[sourceIndex]) page.setRotation(degrees(rotations[sourceIndex]));
      merged.addPage(page);
    });
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

export type PageOp = { source: number; rotate?: 0 | 90 | 180 | 270 };

function validatePageSource(source: number, pageCount: number): void {
  if (!Number.isInteger(source) || source < 1 || source > pageCount) {
    throw new AppError('PROCESSING_FAILED', 400, `Page ${source} is outside the document.`);
  }
}

export async function applyPageOps(input: string, output: string, ops: PageOp[]): Promise<void> {
  const source = await loadPdf(input);
  if (!ops.length) throw new AppError('PROCESSING_FAILED', 400, 'Select at least one page.');
  ops.forEach((op) => validatePageSource(op.source, source.getPageCount()));
  const result = await PDFDocument.create();
  for (const op of ops) {
    const [page] = await result.copyPages(source, [op.source - 1]);
    if (op.rotate) page.setRotation(degrees((page.getRotation().angle + op.rotate) % 360));
    result.addPage(page);
  }
  await fs.writeFile(output, await result.save());
}

export type PageNumberOptions = {
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  format: '1' | 'Page 1' | '1 / 10' | 'Page 1 of 10';
  fontFamily: 'Helvetica' | 'Times' | 'Courier';
  fontSize: number;
  color: string;
  startNumber: number;
  pages: number[] | 'all';
};

const standardFonts = {
  Helvetica: StandardFonts.Helvetica,
  Times: StandardFonts.TimesRoman,
  Courier: StandardFonts.Courier,
} as const;

function parseColor(value: string): ReturnType<typeof rgb> {
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new AppError('PROCESSING_FAILED', 400, 'Color must be a six-digit hex value.');
  return rgb(
    Number.parseInt(value.slice(1, 3), 16) / 255,
    Number.parseInt(value.slice(3, 5), 16) / 255,
    Number.parseInt(value.slice(5, 7), 16) / 255,
  );
}

function selectedPageIndices(pages: number[] | 'all', count: number): number[] {
  const values = pages === 'all' ? Array.from({ length: count }, (_value, index) => index + 1) : pages;
  values.forEach((page) => validatePageSource(page, count));
  return values.map((page) => page - 1);
}

export async function addPageNumbers(input: string, output: string, options: PageNumberOptions): Promise<void> {
  const document = await loadPdf(input);
  const font = await document.embedFont(standardFonts[options.fontFamily]);
  const color = parseColor(options.color);
  const indices = new Set(selectedPageIndices(options.pages, document.getPageCount()));
  document.getPages().forEach((page, index) => {
    if (!indices.has(index)) return;
    const number = options.startNumber + index;
    const text = options.format === '1' ? String(number)
      : options.format === 'Page 1' ? `Page ${number}`
        : options.format === '1 / 10' ? `${number} / ${document.getPageCount()}`
          : `Page ${number} of ${document.getPageCount()}`;
    const width = page.getWidth();
    const height = page.getHeight();
    const textWidth = font.widthOfTextAtSize(text, options.fontSize);
    const margin = Math.max(12, options.fontSize);
    const x = options.position.endsWith('left') ? margin : options.position.endsWith('right') ? width - textWidth - margin : (width - textWidth) / 2;
    const y = options.position.startsWith('top') ? height - options.fontSize - margin : margin;
    page.drawText(text, { x, y, size: options.fontSize, font, color });
  });
  await fs.writeFile(output, await document.save());
}

export type WatermarkOptions = {
  kind: 'text' | 'image';
  pages: number[] | 'all';
  text?: string;
  fontFamily?: 'Helvetica' | 'Times' | 'Courier';
  fontSize?: number;
  color?: string;
  opacity: number;
  rotation: number;
  position: 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'tiled';
  imagePath?: string;
  imageType?: 'png' | 'jpg';
  scale?: number;
};

function watermarkPoint(position: WatermarkOptions['position'], width: number, height: number, contentWidth: number, contentHeight: number): { x: number; y: number } {
  const horizontal = position.endsWith('left') ? 0.15 : position.endsWith('right') ? 0.85 : 0.5;
  const vertical = position.startsWith('top') ? 0.82 : position.startsWith('bottom') ? 0.18 : 0.5;
  return { x: width * horizontal - contentWidth / 2, y: height * vertical - contentHeight / 2 };
}

export async function addWatermark(input: string, output: string, options: WatermarkOptions): Promise<void> {
  const document = await loadPdf(input);
  const indices = selectedPageIndices(options.pages, document.getPageCount());
  const color = parseColor(options.color ?? '#4f46e5');
  const font = options.kind === 'text' ? await document.embedFont(standardFonts[options.fontFamily ?? 'Helvetica']) : undefined;
  const image = options.kind === 'image' && options.imagePath
    ? options.imageType === 'png'
      ? await document.embedPng(await fs.readFile(options.imagePath))
      : await document.embedJpg(await fs.readFile(options.imagePath))
    : undefined;
  if (options.kind === 'text' && (!font || !options.text?.trim())) throw new AppError('PROCESSING_FAILED', 400, 'Enter watermark text.');
  if (options.kind === 'image' && !image) throw new AppError('PROCESSING_FAILED', 400, 'Select a PNG or JPG watermark image.');
  indices.forEach((index) => {
    const page = document.getPages()[index];
    if (options.kind === 'text' && font && options.text) {
      const size = options.fontSize ?? 36;
      const width = font.widthOfTextAtSize(options.text, size);
      const point = watermarkPoint(options.position, page.getWidth(), page.getHeight(), width, size);
      if (options.position === 'tiled') {
        for (let x = 0; x < page.getWidth(); x += width + 90) {
          for (let y = 0; y < page.getHeight(); y += size * 3) {
            page.drawText(options.text, { x, y, size, font, color, opacity: options.opacity, rotate: degrees(options.rotation) });
          }
        }
      } else {
        page.drawText(options.text, { ...point, size, font, color, opacity: options.opacity, rotate: degrees(options.rotation) });
      }
    } else if (image) {
      const scale = (options.scale ?? 35) / 100;
      const dimensions = image.scale(scale);
      const point = watermarkPoint(options.position, page.getWidth(), page.getHeight(), dimensions.width, dimensions.height);
      page.drawImage(image, { ...point, width: dimensions.width, height: dimensions.height, opacity: options.opacity, rotate: degrees(options.rotation) });
    }
  });
  await fs.writeFile(output, await document.save());
}

export type CropOptions = { box: { x: number; y: number; width: number; height: number }; applyTo: 'page' | 'all'; page?: number };

export async function cropPdf(input: string, output: string, options: CropOptions): Promise<void> {
  const document = await loadPdf(input);
  const pages = options.applyTo === 'all'
    ? document.getPages()
    : [document.getPages()[selectedPageIndices([options.page ?? 0], document.getPageCount())[0]]];
  pages.forEach((page) => {
    const media = page.getMediaBox();
    const x = Math.max(media.x, Math.min(media.x + media.width, media.x + options.box.x));
    const y = Math.max(media.y, Math.min(media.y + media.height, media.y + options.box.y));
    const right = Math.max(x, Math.min(media.x + media.width, x + Math.max(1, options.box.width)));
    const top = Math.max(y, Math.min(media.y + media.height, y + Math.max(1, options.box.height)));
    page.setCropBox(x, y, right - x, top - y);
  });
  await fs.writeFile(output, await document.save());
}

async function runQpdf(args: string[]): Promise<void> {
  try {
    await run(process.env.QPDF_PATH || 'qpdf', args, { timeout: 120_000 });
  } catch (error) {
    const details = error as { code?: string };
    if (details.code === 'ENOENT') throw new AppError('ENGINE_UNAVAILABLE', 503, 'The PDF security engine is unavailable.');
    throw new AppError('PROCESSING_FAILED', 422, 'The PDF could not be processed.');
  }
}

export type ProtectOptions = {
  userPassword?: string;
  ownerPassword: string;
  allowPrinting: boolean;
  allowEditing: boolean;
  allowCopying: boolean;
};

export async function protectPdf(input: string, output: string, options: ProtectOptions): Promise<void> {
  if (!options.ownerPassword) throw new AppError('PROCESSING_FAILED', 400, 'An owner password is required.');
  await runQpdf([
    '--encrypt',
    options.userPassword ?? '',
    options.ownerPassword,
    '256',
    `--print=${options.allowPrinting ? 'full' : 'none'}`,
    `--modify=${options.allowEditing ? 'all' : 'none'}`,
    `--extract=${options.allowCopying ? 'y' : 'n'}`,
    '--',
    input,
    output,
  ]);
}

export async function unlockPdf(input: string, output: string, password: string): Promise<void> {
  try {
    const result = await run(process.env.QPDF_PATH || 'qpdf', ['--show-encryption', input], { timeout: 30_000 });
    const encryption = `${result.stdout}\n${result.stderr}`.toLowerCase();
    if (encryption.includes('not encrypted') || encryption.includes('encryption: no')) {
      throw new AppError('PROCESSING_FAILED', 400, 'This PDF is not encrypted.');
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    const details = error as { code?: string; stderr?: string; message?: string };
    const message = `${details.stderr ?? ''} ${details.message ?? ''}`.toLowerCase();
    if (details.code === 'ENOENT') throw new AppError('ENGINE_UNAVAILABLE', 503, 'The PDF security engine is unavailable.');
    if (!message.includes('password') && !message.includes('encrypted')) {
      throw new AppError('CORRUPT_PDF', 422, 'The PDF appears to be corrupted.');
    }
  }
  if (!password) throw new AppError('PASSWORD_REQUIRED', 400, 'Enter the PDF password.');
  try {
    await run(process.env.QPDF_PATH || 'qpdf', [`--password=${password}`, '--decrypt', input, output], { timeout: 120_000 });
  } catch {
    throw new AppError('WRONG_PASSWORD', 422, 'The password is incorrect.');
  }
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

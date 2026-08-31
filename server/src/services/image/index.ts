import fs from 'node:fs/promises';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { AppError } from '../../errors';

export interface ImageConversionOptions {
  pageSize: 'A4' | 'Letter' | 'fit';
  orientation: 'portrait' | 'landscape' | 'auto';
  margin: number;
  fitMode: 'contain' | 'cover';
}

const sizes = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
} as const;

function pageDimensions(options: ImageConversionOptions, width: number, height: number): { width: number; height: number } {
  if (options.pageSize === 'fit') return { width: width + options.margin * 2, height: height + options.margin * 2 };
  const base = sizes[options.pageSize];
  const landscape = options.orientation === 'landscape' || (options.orientation === 'auto' && width > height);
  return landscape ? { width: base.height, height: base.width } : base;
}

export async function imagesToPdf(inputs: string[], output: string, options: ImageConversionOptions): Promise<void> {
  if (!inputs.length) throw new AppError('PROCESSING_FAILED', 400, 'Add at least one image.');
  const document = await PDFDocument.create();
  for (const input of inputs) {
    const normalized = await sharp(input).rotate().flatten({ background: '#ffffff' }).jpeg({ quality: 94 }).toBuffer({ resolveWithObject: true });
    const image = await document.embedJpg(normalized.data);
    const page = pageDimensions(options, normalized.info.width, normalized.info.height);
    const margin = Math.max(0, Math.min(options.margin, Math.min(page.width, page.height) / 2 - 1));
    const availableWidth = page.width - margin * 2;
    const availableHeight = page.height - margin * 2;
    const scale = options.fitMode === 'cover'
      ? Math.max(availableWidth / image.width, availableHeight / image.height)
      : Math.min(availableWidth / image.width, availableHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const drawWidth = options.fitMode === 'cover' ? Math.min(width, availableWidth) : width;
    const drawHeight = options.fitMode === 'cover' ? Math.min(height, availableHeight) : height;
    const pageRef = document.addPage([page.width, page.height]);
    pageRef.drawImage(image, {
      x: margin + (availableWidth - drawWidth) / 2,
      y: margin + (availableHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  }
  await fs.writeFile(output, await document.save());
}

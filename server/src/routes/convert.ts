import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import archiver from 'archiver';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import PptxGenJS from 'pptxgenjs';
import * as XLSX from 'xlsx';
import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../errors';
import { uploadFactory, validateUploads, sanitizeFilename } from '../middleware/upload';
import { pageInfo } from '../services/pdf/engine';
import { createWorkspace, registerResult } from '../services/storage/workspace';
import { imagesToPdf } from '../services/image';
import { rasterizePdf } from '../services/image/rasterize';
import { convertOfficeToPdf } from '../services/office/convert';
import { assertPublicUrl, renderHtmlToPdf } from '../services/office/render';
import { ocrLanguages, runOcr } from '../services/ocr';
import sharp from 'sharp';

const run = promisify(execFile);
const router = Router();
const pdfUpload = uploadFactory(['pdf'], false);
const imageUploads = uploadFactory(['image'], true);
const officeUpload = uploadFactory(['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'], false);
const htmlUpload = uploadFactory(['html'], false);
const outputOptions = z.object({
  pageSize: z.enum(['A4', 'Letter', 'fit']).default('A4'),
  orientation: z.enum(['portrait', 'landscape', 'auto']).default('auto'),
  margin: z.coerce.number().min(0).max(144).default(24),
  fitMode: z.enum(['contain', 'cover']).default('contain'),
});

function resultUrl(jobId: string, fileId: string): string {
  return `/api/files/${jobId}/${fileId}`;
}

async function outputFile(workspace: { jobId: string; directory: string }, name: string, sourcePath: string): Promise<Record<string, string>> {
  const fileId = crypto.randomUUID();
  await fs.rename(sourcePath, path.join(workspace.directory, fileId));
  await registerResult(workspace.directory, fileId, name);
  return { fileId, name, downloadUrl: resultUrl(workspace.jobId, fileId) };
}

async function zipFiles(workspace: { jobId: string; directory: string }, files: Array<{ path: string; name: string }>, name: string): Promise<string> {
  const fileId = crypto.randomUUID();
  const zipPath = path.join(workspace.directory, fileId);
  const archive = archiver('zip');
  const stream = (await fs.open(zipPath, 'w')).createWriteStream();
  archive.pipe(stream);
  files.forEach((file) => archive.file(file.path, { name: file.name }));
  await archive.finalize();
  await new Promise<void>((resolve, reject) => {
    stream.on('close', resolve);
    stream.on('error', reject);
  });
  await registerResult(workspace.directory, fileId, name);
  return resultUrl(workspace.jobId, fileId);
}

const pageSelection = z.string().default('all').transform((value) => value === 'all' ? undefined : value.split(',').map(Number));

router.post('/jpg-to-pdf', imageUploads.array('files'), async (request, response, next) => {
  try {
    const files = await validateUploads(request, ['image']);
    const options = outputOptions.parse(request.body);
    const workspace = await createWorkspace();
    const source = path.join(workspace.directory, 'images.pdf');
    await imagesToPdf(files.map((file) => file.path), source, {
      pageSize: options.pageSize,
      orientation: options.orientation,
      margin: options.margin,
      fitMode: options.fitMode,
    });
    response.json({ jobId: workspace.jobId, files: [await outputFile(workspace, 'images.pdf', source)] });
  } catch (error) {
    next(error);
  }
});

router.post('/scan-to-pdf', imageUploads.array('files'), async (request, response, next) => {
  try {
    const files = await validateUploads(request, ['image']);
    const options = outputOptions.parse(request.body);
    const enhanced: string[] = [];
    const workspace = await createWorkspace();
    for (const file of files) {
      const target = path.join(workspace.directory, `scan-${enhanced.length}.jpg`);
      let image = sharp(file.path).rotate().grayscale().normalize().sharpen();
      if (request.body.enhance === 'false') image = sharp(file.path).rotate();
      await image.jpeg({ quality: 92 }).toFile(target);
      enhanced.push(target);
    }
    const source = path.join(workspace.directory, 'scanned.pdf');
    await imagesToPdf(enhanced, source, {
      pageSize: options.pageSize,
      orientation: options.orientation,
      margin: options.margin,
      fitMode: options.fitMode,
    });
    response.json({ jobId: workspace.jobId, files: [await outputFile(workspace, 'scanned.pdf', source)] });
  } catch (error) {
    next(error);
  }
});

router.post('/word-to-pdf', officeUpload.single('file'), officeRoute('word'));
router.post('/ppt-to-pdf', officeUpload.single('file'), officeRoute('powerpoint'));
router.post('/excel-to-pdf', officeUpload.single('file'), officeRoute('excel'));

function officeRoute(kind: 'word' | 'powerpoint' | 'excel') {
  return async (request: Parameters<Parameters<typeof router.post>[1]>[0], response: Parameters<Parameters<typeof router.post>[1]>[1], next: Parameters<Parameters<typeof router.post>[1]>[2]) => {
    try {
      const [file] = await validateUploads(request, kind === 'word' ? ['doc', 'docx'] : kind === 'powerpoint' ? ['ppt', 'pptx'] : ['xls', 'xlsx']);
      const workspace = await createWorkspace();
      const source = path.join(workspace.directory, 'converted.pdf');
      await convertOfficeToPdf(file.path, source, workspace.directory, kind);
      const name = `${path.basename(sanitizeFilename(file.originalname), path.extname(file.originalname))}.pdf`;
      response.json({ jobId: workspace.jobId, files: [await outputFile(workspace, name, source)] });
    } catch (error) {
      next(error);
    }
  };
}

router.post('/html-to-pdf', htmlUpload.single('file'), async (request, response, next) => {
  try {
    const mode = z.enum(['html', 'url']).default('html').parse(request.body.mode ?? 'html');
    const options = z.object({
      pageSize: z.enum(['A4', 'Letter']).default('A4'),
      orientation: z.enum(['portrait', 'landscape']).default('portrait'),
      margin: z.coerce.number().min(0).max(144).default(24),
      printBackground: z.preprocess((value) => value !== 'false', z.boolean()).default(true),
    }).parse(request.body);
    const workspace = await createWorkspace();
    const source = path.join(workspace.directory, 'html.pdf');
    if (mode === 'url') {
      const url = await assertPublicUrl(String(request.body.url ?? ''));
      await renderHtmlToPdf(source, options, { url: url.toString() });
    } else if (request.file) {
      await validateUploads(request, ['html']);
      await renderHtmlToPdf(source, options, { html: await fs.readFile(request.file.path, 'utf8') });
    } else {
      const html = z.string().min(1).parse(request.body.html);
      await renderHtmlToPdf(source, options, { html });
    }
    response.json({ jobId: workspace.jobId, files: [await outputFile(workspace, 'html.pdf', source)] });
  } catch (error) {
    next(error);
  }
});

router.post('/pdf-to-jpg', pdfUpload.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const format = z.enum(['jpg', 'png', 'webp']).parse(request.body.format ?? 'jpg');
    const quality = z.coerce.number().min(1).max(100).default(85).parse(request.body.quality);
    const dpi = z.coerce.number().min(36).max(600).default(150).parse(request.body.dpi);
    const info = await pageInfo(file.path);
    const pages = pageSelection.parse(request.body.pages);
    if (pages) pages.forEach((page) => { if (!Number.isInteger(page) || page < 1 || page > info.pages) throw new AppError('PROCESSING_FAILED', 400, `Page ${page} is outside the document.`); });
    const workspace = await createWorkspace();
    const rendered = await rasterizePdf(file.path, path.join(workspace.directory, 'raster'), { pages, dpi, format, quality });
    const renderedNames = rendered.map((raster) => ({ path: raster.path, name: `${path.basename(file.originalname, path.extname(file.originalname))}-${raster.page}.${format}` }));
    const downloadAllUrl = await zipFiles(workspace, renderedNames, `${path.basename(file.originalname, path.extname(file.originalname))}-images.zip`);
    const files = [];
    for (const renderedName of renderedNames) files.push(await outputFile(workspace, renderedName.name, renderedName.path));
    response.json({ jobId: workspace.jobId, files, downloadAllUrl });
  } catch (error) {
    next(error);
  }
});

router.post('/pdf-to-word', pdfUpload.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const text = (await run('pdftotext', ['-layout', file.path, '-'], { timeout: 60_000 })).stdout;
    const pages = text.split('\f');
    const sections = pages.map((page) => ({
      children: page.split(/\r?\n/).map((line) => new Paragraph({ children: [new TextRun(line)] })),
    }));
    const document = new Document({ sections });
    const workspace = await createWorkspace();
    const source = path.join(workspace.directory, 'converted.docx');
    await fs.writeFile(source, await Packer.toBuffer(document));
    response.json({ jobId: workspace.jobId, files: [await outputFile(workspace, 'converted.docx', source)] });
  } catch (error) {
    next(error);
  }
});

router.post('/pdf-to-ppt', pdfUpload.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const workspace = await createWorkspace();
    const rendered = await rasterizePdf(file.path, path.join(workspace.directory, 'slides'), { dpi: 144, format: 'jpg', quality: 88 });
    const text = (await run('pdftotext', ['-layout', file.path, '-'], { timeout: 60_000 })).stdout.split('\f');
    const presentation = new PptxGenJS();
    presentation.layout = 'LAYOUT_WIDE';
    rendered.forEach((raster, index) => {
      const slide = presentation.addSlide();
      slide.addImage({ path: raster.path, x: 0, y: 0, w: 13.333, h: 7.5 });
      slide.addNotes(text[index] ?? '');
    });
    const source = path.join(workspace.directory, 'converted.pptx');
    await presentation.writeFile({ fileName: source });
    response.json({ jobId: workspace.jobId, files: [await outputFile(workspace, 'converted.pptx', source)] });
  } catch (error) {
    next(error);
  }
});

router.post('/pdf-to-excel', pdfUpload.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const pages = (await run('pdftotext', ['-layout', file.path, '-'], { timeout: 60_000 })).stdout.split('\f');
    const workbook = XLSX.utils.book_new();
    let found = false;
    pages.forEach((page, index) => {
      const rows = page.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/));
      if (rows.some((row) => row.length > 1)) {
        found = true;
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), `Page ${index + 1}`.slice(0, 31));
      }
    });
    if (!found) throw new AppError('PROCESSING_FAILED', 422, 'No tabular structure was detected; no spreadsheet was generated.');
    const workspace = await createWorkspace();
    const source = path.join(workspace.directory, 'converted.xlsx');
    XLSX.writeFile(workbook, source);
    response.json({ jobId: workspace.jobId, files: [await outputFile(workspace, 'converted.xlsx', source)] });
  } catch (error) {
    next(error);
  }
});

router.post('/pdf-to-pdfa', pdfUpload.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const workspace = await createWorkspace();
    const source = path.join(workspace.directory, 'archival.pdf');
    const definition = process.env.PDFA_DEF_PATH || '/usr/share/ghostscript/9.55.0/lib/PDFA_def.ps';
    try {
      await fs.access(definition);
    } catch {
      throw new AppError('ENGINE_UNAVAILABLE', 503, 'The PDF/A definition file is unavailable on this deployment.');
    }
    await run(process.env.GHOSTSCRIPT_PATH || 'gs', [
      '-dBATCH', '-dNOPAUSE', '-dPDFA=2', '-dPDFACompatibilityPolicy=1',
      '-sDEVICE=pdfwrite', '-sColorConversionStrategy=RGB', '-sOutputFile=' + source, definition, file.path,
    ], { timeout: 120_000 });
    const validation = process.env.VERAPDF_PATH ? 'Validation configured; independent validator should be run by deployment.' : 'Converted; independent validation not available in this deployment.';
    const result = await outputFile(workspace, 'archival-pdfa-2b.pdf', source);
    response.json({ jobId: workspace.jobId, validation, pdfaVersion: 'PDF/A-2', files: [result] });
  } catch (error) {
    next(error);
  }
});

router.post('/repair', pdfUpload.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const workspace = await createWorkspace();
    const source = path.join(workspace.directory, 'repaired.pdf');
    try {
      await run(process.env.QPDF_PATH || 'qpdf', [file.path, source], { timeout: 120_000 });
    } catch {
      try {
        await run(process.env.GHOSTSCRIPT_PATH || 'gs', ['-dBATCH', '-dNOPAUSE', '-sDEVICE=pdfwrite', `-sOutputFile=${source}`, file.path], { timeout: 120_000 });
      } catch {
        throw new AppError('PROCESSING_FAILED', 422, 'This file cannot be repaired.');
      }
    }
    try {
      if ((await pageInfo(source)).pages < 1) throw new Error('empty');
    } catch {
      throw new AppError('PROCESSING_FAILED', 422, 'This file cannot be repaired.');
    }
    response.json({ jobId: workspace.jobId, files: [await outputFile(workspace, 'repaired.pdf', source)] });
  } catch (error) {
    next(error);
  }
});

router.post('/ocr', pdfUpload.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const language = z.enum(ocrLanguages).parse(request.body.language ?? 'eng');
    const dpi = z.coerce.number().min(200).max(300).default(250).parse(request.body.dpi);
    const workspace = await createWorkspace();
    const result = await runOcr(file.path, workspace.directory, { language, dpi });
    const files = [];
    if (result.pdfPath) files.push(await outputFile(workspace, 'searchable.pdf', result.pdfPath));
    files.push(await outputFile(workspace, 'ocr-text.txt', result.textPath));
    response.json({ jobId: workspace.jobId, characterCount: result.characterCount, unicodeFontConfigured: result.unicodeFontConfigured, message: result.pdfPath ? 'Searchable PDF created.' : 'Text extracted. Configure a Unicode font to embed a searchable layer for this script.', files });
  } catch (error) {
    next(error);
  }
});

export default router;

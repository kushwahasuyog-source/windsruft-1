import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import archiver from 'archiver';
import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../errors';
import { sanitizeFilename, uploadFactory, validateUploads } from '../middleware/upload';
import {
  addPageNumbers,
  addWatermark,
  applyPageOps,
  compressPdf,
  cropPdf,
  mergePdfs,
  pageInfo,
  protectPdf,
  rotatePdf,
  splitPdf,
  unlockPdf,
  type PageNumberOptions,
  type PageOp,
} from '../services/pdf/engine';
import { createWorkspace, registerResult } from '../services/storage/workspace';

const router = Router();
const manyPdfs = uploadFactory(['pdf'], true);
const onePdf = uploadFactory(['pdf'], false);
const watermarkUpload = uploadFactory(['pdf', 'image'], true);
const levelSchema = z.enum(['low', 'recommended', 'high']);

function parsePageRanges(value: string, pageCount: number): number[] {
  const pages: number[] = [];
  for (const token of value.split(',').map((part) => part.trim())) {
    const parts = token.split('-').map(Number);
    if (parts.length > 2 || parts.some((part) => !Number.isInteger(part))) {
      throw new AppError('PROCESSING_FAILED', 400, 'Pages must be valid 1-based numbers or ranges.');
    }
    const [start, end = parts[0]] = parts;
    if (!start || !end || start < 1 || end < start || end > pageCount) {
      throw new AppError('PROCESSING_FAILED', 400, 'Selected pages are outside the document.');
    }
    for (let page = start; page <= end; page += 1) pages.push(page - 1);
  }
  if (!pages.length) throw new AppError('PROCESSING_FAILED', 400, 'Select at least one page.');
  return pages;
}

function parseJson<T>(value: unknown, schema: z.ZodType<T>, message: string): T {
  try {
    return schema.parse(JSON.parse(String(value)));
  } catch {
    throw new AppError('PROCESSING_FAILED', 400, message);
  }
}

function parseSelection(value: unknown, pageCount: number): number[] | 'all' {
  if (value === undefined || value === 'all') return 'all';
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    const pages = parseJson(value, z.array(z.number().int().positive()).min(1), 'Select one or more pages.');
    pages.forEach((page) => {
      if (page > pageCount) throw new AppError('PROCESSING_FAILED', 400, `Page ${page} is outside the document.`);
    });
    return pages;
  }
  return parsePageRanges(String(value), pageCount).map((page) => page + 1);
}

async function singleResult(
  workspace: { jobId: string; directory: string },
  fileId: string,
  name: string,
): Promise<Record<string, string>> {
  await registerResult(workspace.directory, fileId, name);
  return { fileId, name, downloadUrl: `/api/files/${workspace.jobId}/${fileId}` };
}

function fileResponse(jobId: string, files: Array<Record<string, unknown>>, downloadAllUrl?: string) {
  return { jobId, files, ...(downloadAllUrl ? { downloadAllUrl } : {}) };
}

router.post('/compress', manyPdfs.array('files'), async (request, response, next) => {
  try {
    const files = await validateUploads(request, ['pdf']);
    const level = levelSchema.parse(request.body.level ?? 'recommended');
    const workspace = await createWorkspace();
    const results: Array<Record<string, unknown>> = [];
    for (const file of files) {
      const fileId = crypto.randomUUID();
      const output = path.join(workspace.directory, fileId);
      const result = await compressPdf(file.path, output, level);
      const name = `${path.basename(sanitizeFilename(file.originalname), path.extname(file.originalname))}-compressed.pdf`;
      await registerResult(workspace.directory, fileId, name);
      results.push({
        fileId,
        name,
        downloadUrl: `/api/files/${workspace.jobId}/${fileId}`,
        ...result,
      });
    }
    response.json(fileResponse(workspace.jobId, results));
  } catch (error) {
    next(error);
  }
});

router.post('/merge', manyPdfs.array('files'), async (request, response, next) => {
  try {
    const files = await validateUploads(request, ['pdf']);
    if (files.length < 2) throw new AppError('PROCESSING_FAILED', 400, 'Select at least two PDF files.');
    const order = request.body.order
      ? z.array(z.number().int().nonnegative()).parse(JSON.parse(request.body.order))
      : files.map((_file, index) => index);
    const rotations = request.body.rotations
      ? z.array(z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])).parse(JSON.parse(request.body.rotations))
      : files.map(() => 0);
    if (order.length !== files.length || new Set(order).size !== files.length || order.some((index) => index >= files.length)) {
      throw new AppError('PROCESSING_FAILED', 400, 'Invalid file order.');
    }
    if (rotations.length !== files.length) throw new AppError('PROCESSING_FAILED', 400, 'Invalid file rotations.');
    const workspace = await createWorkspace();
    const fileId = crypto.randomUUID();
    await mergePdfs(order.map((index) => files[index].path), path.join(workspace.directory, fileId), order.map((index) => rotations[index]));
    await registerResult(workspace.directory, fileId, 'merged.pdf');
    response.json(fileResponse(workspace.jobId, [{
      fileId,
      name: 'merged.pdf',
      downloadUrl: `/api/files/${workspace.jobId}/${fileId}`,
    }]));
  } catch (error) {
    next(error);
  }
});

router.post('/rotate', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const angle = z.union([z.literal(90), z.literal(180), z.literal(270)]).parse(Number(request.body.angle));
    const pages = z.string().default('all').parse(request.body.pages ?? 'all');
    const info = await pageInfo(file.path);
    const selected = pages === 'all'
      ? []
      : pages.split(',').map((value) => Number(value.trim()) - 1).filter((page) => page >= 0 && page < info.pages);
    const workspace = await createWorkspace();
    const fileId = crypto.randomUUID();
    await rotatePdf(file.path, path.join(workspace.directory, fileId), selected, angle);
    await registerResult(workspace.directory, fileId, 'rotated.pdf');
    response.json(fileResponse(workspace.jobId, [{
      fileId,
      name: 'rotated.pdf',
      downloadUrl: `/api/files/${workspace.jobId}/${fileId}`,
    }]));
  } catch (error) {
    next(error);
  }
});

router.post('/split', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const mode = z.enum(['every-page', 'ranges', 'extract']).parse(request.body.mode ?? 'every-page');
    const info = await pageInfo(file.path);
    let groups: number[][];
    if (mode === 'every-page') {
      groups = Array.from({ length: info.pages }, (_value, index) => [index]);
    } else {
      const raw = z.string().min(1).parse(request.body.ranges ?? request.body.pages);
      const tokens = raw.split(',').map((value) => value.trim());
      groups = mode === 'extract'
        ? [parsePageRanges(raw, info.pages)]
        : tokens.map((token) => parsePageRanges(token, info.pages));
    }
    if (!groups.length || groups.some((group) => group.some((page) => page < 0 || page >= info.pages))) {
      throw new AppError('PROCESSING_FAILED', 400, 'Selected pages are outside the document.');
    }
    const workspace = await createWorkspace();
    const splitFiles = await splitPdf(file.path, groups, workspace.directory);
    const zipId = crypto.randomUUID();
    const zipPath = path.join(workspace.directory, zipId);
    const archive = archiver('zip');
    const zipStream = (await fs.open(zipPath, 'w')).createWriteStream();
    archive.pipe(zipStream);
    splitFiles.forEach((splitFile) => archive.file(splitFile.path, { name: splitFile.name }));
    await archive.finalize();
    await new Promise<void>((resolve, reject) => {
      zipStream.on('close', () => resolve());
      zipStream.on('error', reject);
    });
    const baseName = path.basename(sanitizeFilename(file.originalname), path.extname(file.originalname));
    await registerResult(workspace.directory, zipId, `${baseName}-split.zip`);
    for (const [index, splitFile] of splitFiles.entries()) await registerResult(workspace.directory, splitFile.id, `${baseName}-${index + 1}.pdf`);
    response.json(fileResponse(
      workspace.jobId,
      splitFiles.map((splitFile, index) => ({
        fileId: splitFile.id,
        name: `${baseName}-${index + 1}.pdf`,
        downloadUrl: `/api/files/${workspace.jobId}/${splitFile.id}`,
      })),
      `/api/files/${workspace.jobId}/${zipId}`,
    ));
  } catch (error) {
    next(error);
  }
});

router.post('/page-info', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    response.json(await pageInfo(file.path));
  } catch (error) {
    next(error);
  }
});

router.post('/remove-pages', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const info = await pageInfo(file.path);
    const pages = parseJson(request.body.pages, z.array(z.number().int().positive()).min(1), 'Select one or more pages.');
    pages.forEach((page) => {
      if (page > info.pages) throw new AppError('PROCESSING_FAILED', 400, `Page ${page} is outside the document.`);
    });
    if (pages.length >= info.pages) throw new AppError('PROCESSING_FAILED', 400, 'You cannot remove every page.');
    const removed = new Set(pages);
    const ops: PageOp[] = Array.from({ length: info.pages }, (_value, index) => ({ source: index + 1 }))
      .filter((op) => !removed.has(op.source));
    const workspace = await createWorkspace();
    const fileId = crypto.randomUUID();
    await applyPageOps(file.path, path.join(workspace.directory, fileId), ops);
    response.json(fileResponse(workspace.jobId, [await singleResult(workspace, fileId, 'pages-removed.pdf')]));
  } catch (error) {
    next(error);
  }
});

router.post('/extract-pages', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const info = await pageInfo(file.path);
    const pages = request.body.pages
      ? parseJson(request.body.pages, z.array(z.number().int().positive()).min(1), 'Select one or more pages.')
      : parsePageRanges(String(request.body.ranges ?? ''), info.pages).map((page) => page + 1);
    pages.forEach((page) => {
      if (page > info.pages) throw new AppError('PROCESSING_FAILED', 400, `Page ${page} is outside the document.`);
    });
    const workspace = await createWorkspace();
    const fileId = crypto.randomUUID();
    await applyPageOps(file.path, path.join(workspace.directory, fileId), pages.map((source) => ({ source })));
    response.json(fileResponse(workspace.jobId, [await singleResult(workspace, fileId, 'extracted-pages.pdf')]));
  } catch (error) {
    next(error);
  }
});

router.post('/organize', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const ops = parseJson(request.body.ops, z.array(z.object({
      source: z.number().int().positive(),
      rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
    })).min(1), 'Add at least one page operation.');
    const workspace = await createWorkspace();
    const fileId = crypto.randomUUID();
    await applyPageOps(file.path, path.join(workspace.directory, fileId), ops);
    response.json(fileResponse(workspace.jobId, [await singleResult(workspace, fileId, 'organized.pdf')]));
  } catch (error) {
    next(error);
  }
});

router.post('/page-numbers', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const info = await pageInfo(file.path);
    const options = {
      position: request.body.position,
      format: request.body.format,
      fontFamily: request.body.fontFamily,
      fontSize: Number(request.body.fontSize),
      color: request.body.color,
      startNumber: Number(request.body.startNumber),
      pages: parseSelection(request.body.pages, info.pages),
    };
    const validated = z.object({
      position: z.enum(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']),
      format: z.enum(['1', 'Page 1', '1 / 10', 'Page 1 of 10']),
      fontFamily: z.enum(['Helvetica', 'Times', 'Courier']),
      fontSize: z.number().min(6).max(120),
      color: z.string().regex(/^#[0-9a-f]{6}$/i),
      startNumber: z.number().int().min(0),
      pages: z.union([z.literal('all'), z.array(z.number().int().positive())]),
    }).parse(options) as PageNumberOptions;
    const workspace = await createWorkspace();
    const fileId = crypto.randomUUID();
    await addPageNumbers(file.path, path.join(workspace.directory, fileId), validated);
    response.json(fileResponse(workspace.jobId, [await singleResult(workspace, fileId, 'numbered.pdf')]));
  } catch (error) {
    next(error);
  }
});

router.post('/watermark', watermarkUpload.fields([{ name: 'file', maxCount: 1 }, { name: 'image', maxCount: 1 }]), async (request, response, next) => {
  try {
    const fields = request.files as { file?: Express.Multer.File[]; image?: Express.Multer.File[] } | undefined;
    const file = fields?.file?.[0];
    if (!file) throw new AppError('INVALID_FILE_TYPE', 400, 'Please select a PDF file.');
    await validateUploads(request, ['pdf', 'image']);
    const info = await pageInfo(file.path);
    const kind = z.enum(['text', 'image']).parse(request.body.kind ?? 'text');
    const position = z.enum(['top-left', 'top-center', 'top-right', 'middle-left', 'center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right', 'tiled']).parse(request.body.position ?? 'center');
    const options = {
      kind,
      pages: parseSelection(request.body.pages, info.pages),
      text: request.body.text,
      fontFamily: request.body.fontFamily,
      fontSize: Number(request.body.fontSize ?? 36),
      color: request.body.color ?? '#4f46e5',
      opacity: Number(request.body.opacity ?? 0.3),
      rotation: Number(request.body.rotation ?? 0),
      position,
      imagePath: fields?.image?.[0]?.path,
      imageType: fields?.image?.[0] ? path.extname(fields.image[0].originalname).slice(1).toLowerCase() === 'png' ? 'png' : 'jpg' : undefined,
      scale: Number(request.body.scale ?? 35),
    };
    if (kind === 'image') {
      const imageExtension = fields?.image?.[0] ? path.extname(fields.image[0].originalname).slice(1).toLowerCase() : '';
      if (imageExtension !== 'png' && imageExtension !== 'jpg' && imageExtension !== 'jpeg') {
        throw new AppError('INVALID_FILE_TYPE', 400, 'Watermark images must be PNG or JPG files.');
      }
    }
    const validated = z.object({
      kind: z.enum(['text', 'image']),
      pages: z.union([z.literal('all'), z.array(z.number().int().positive())]),
      text: z.string().optional(),
      fontFamily: z.enum(['Helvetica', 'Times', 'Courier']).optional(),
      fontSize: z.number().min(6).max(160),
      color: z.string().regex(/^#[0-9a-f]{6}$/i),
      opacity: z.number().min(0).max(1),
      rotation: z.number().min(-360).max(360),
      position: z.enum(['top-left', 'top-center', 'top-right', 'middle-left', 'center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right', 'tiled']),
      imagePath: z.string().optional(),
      imageType: z.enum(['png', 'jpg']).optional(),
      scale: z.number().min(1).max(200),
    }).parse(validatedWatermark(options, kind));
    const workspace = await createWorkspace();
    const fileId = crypto.randomUUID();
    await addWatermark(file.path, path.join(workspace.directory, fileId), validated);
    response.json(fileResponse(workspace.jobId, [await singleResult(workspace, fileId, 'watermarked.pdf')]));
  } catch (error) {
    next(error);
  }
});

function validatedWatermark(options: Record<string, unknown>, kind: 'text' | 'image'): Record<string, unknown> {
  if (kind === 'text' && typeof options.text !== 'string') throw new AppError('PROCESSING_FAILED', 400, 'Enter watermark text.');
  if (kind === 'image' && typeof options.imagePath !== 'string') throw new AppError('PROCESSING_FAILED', 400, 'Select a PNG or JPG watermark image.');
  return options;
}

router.post('/crop', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const info = await pageInfo(file.path);
    const box = parseJson(request.body.box, z.object({
      x: z.number().finite(),
      y: z.number().finite(),
      width: z.number().positive(),
      height: z.number().positive(),
    }), 'Enter a valid crop box.');
    const options = z.object({
      box: z.object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() }),
      applyTo: z.enum(['page', 'all']),
      page: z.number().int().positive().optional(),
    }).parse({ box, applyTo: request.body.applyTo ?? 'page', page: Number(request.body.page) || undefined });
    if (options.applyTo === 'page' && (!options.page || options.page > info.pages)) throw new AppError('PROCESSING_FAILED', 400, 'Choose a page within the document.');
    const workspace = await createWorkspace();
    const fileId = crypto.randomUUID();
    await cropPdf(file.path, path.join(workspace.directory, fileId), options);
    response.json(fileResponse(workspace.jobId, [await singleResult(workspace, fileId, 'cropped.pdf')]));
  } catch (error) {
    next(error);
  }
});

router.post('/protect', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    if (typeof request.body.ownerPassword !== 'string' || !request.body.ownerPassword) {
      throw new AppError('PROCESSING_FAILED', 400, 'An owner password is required.');
    }
    const booleanField = z.preprocess((value) => value === true || value === 'true', z.boolean());
    const options = z.object({
      userPassword: z.string().optional(),
      ownerPassword: z.string().min(1),
      allowPrinting: booleanField.default(false),
      allowEditing: booleanField.default(false),
      allowCopying: booleanField.default(false),
    }).parse(request.body);
    const workspace = await createWorkspace();
    const fileId = crypto.randomUUID();
    await protectPdf(file.path, path.join(workspace.directory, fileId), options);
    response.json(fileResponse(workspace.jobId, [await singleResult(workspace, fileId, 'protected.pdf')]));
  } catch (error) {
    next(error);
  }
});

router.post('/unlock', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    if (typeof request.body.password !== 'string' || !request.body.password) {
      throw new AppError('PASSWORD_REQUIRED', 400, 'Enter the PDF password.');
    }
    const password = request.body.password;
    const workspace = await createWorkspace();
    const fileId = crypto.randomUUID();
    await unlockPdf(file.path, path.join(workspace.directory, fileId), password);
    response.json(fileResponse(workspace.jobId, [await singleResult(workspace, fileId, 'unlocked.pdf')]));
  } catch (error) {
    next(error);
  }
});

export default router;

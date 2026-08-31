import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import archiver from 'archiver';
import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../errors';
import { sanitizeFilename, uploadFactory, validateUploads } from '../middleware/upload';
import { compressPdf, mergePdfs, pageInfo, rotatePdf, splitPdf } from '../services/pdf/engine';
import { createWorkspace } from '../services/storage/workspace';

const router = Router();
const manyPdfs = uploadFactory(['pdf'], true);
const onePdf = uploadFactory(['pdf'], false);
const levelSchema = z.enum(['low', 'recommended', 'high']);

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
      results.push({
        fileId,
        name: sanitizeFilename(file.originalname),
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
    if (order.length !== files.length || new Set(order).size !== files.length || order.some((index) => index >= files.length)) {
      throw new AppError('PROCESSING_FAILED', 400, 'Invalid file order.');
    }
    const workspace = await createWorkspace();
    const fileId = crypto.randomUUID();
    await mergePdfs(order.map((index) => files[index].path), path.join(workspace.directory, fileId));
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
        ? [tokens.flatMap((token) => {
          const [start, end = start] = token.split('-').map(Number);
          return Array.from({ length: end - start + 1 }, (_value, index) => start + index - 1);
        })]
        : tokens.map((token) => {
          const [start, end] = token.split('-').map(Number);
          if (!start || !end || start > end || start < 1 || end > info.pages) {
            throw new AppError('PROCESSING_FAILED', 400, 'Ranges must match the document page count.');
          }
          return Array.from({ length: end - start + 1 }, (_value, index) => start + index - 1);
        });
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
    response.json(fileResponse(
      workspace.jobId,
      splitFiles.map((splitFile) => ({
        fileId: splitFile.id,
        name: splitFile.name,
        downloadUrl: `/api/files/${workspace.jobId}/${splitFile.id}`,
      })),
      `/api/files/${workspace.jobId}/${zipId}`,
    ));
  } catch (error) {
    next(error);
  }
});

export default router;

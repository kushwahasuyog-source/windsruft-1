import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Response } from 'express';
import { AppError } from '../../errors';

const workspaceRoot = path.resolve(process.env.TMP_DIR ?? os.tmpdir(), 'pdfforge');
const idPattern = /^[a-f0-9-]{36}$/i;

export async function createWorkspace(): Promise<{ jobId: string; directory: string }> {
  const jobId = crypto.randomUUID();
  const directory = path.join(workspaceRoot, jobId);
  await fs.mkdir(directory, { recursive: true });
  return { jobId, directory };
}

export async function sweepWorkspaces(): Promise<void> {
  await fs.mkdir(workspaceRoot, { recursive: true });
  const ttlMs = Number(process.env.TMP_TTL_MINUTES ?? 30) * 60_000;
  const now = Date.now();
  for (const name of await fs.readdir(workspaceRoot)) {
    if (!idPattern.test(name)) continue;
    const candidate = path.join(workspaceRoot, name);
    const stats = await fs.stat(candidate);
    if (now - stats.mtimeMs > ttlMs) await fs.rm(candidate, { recursive: true, force: true });
  }
}

function resolveFile(jobId: string, fileId: string): string {
  if (!idPattern.test(jobId) || !idPattern.test(fileId)) {
    throw new AppError('NOT_FOUND', 404, 'File not found.');
  }
  const jobRoot = path.join(workspaceRoot, jobId);
  const resolved = path.resolve(jobRoot, fileId);
  if (!resolved.startsWith(`${jobRoot}${path.sep}`)) {
    throw new AppError('NOT_FOUND', 404, 'File not found.');
  }
  return resolved;
}

export async function serveFile(
  response: Response,
  jobId: string,
  fileId: string,
  inline: boolean,
): Promise<void> {
  const resolved = resolveFile(jobId, fileId);
  try {
    const stats = await fs.stat(resolved);
    if (!stats.isFile()) throw new Error('not a file');
    const header = Buffer.alloc(4);
    const handle = await fs.open(resolved, 'r');
    await handle.read(header, 0, 4, 0);
    await handle.close();
    const isZip = header[0] === 0x50 && header[1] === 0x4b;
    response.type(isZip ? 'zip' : 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${isZip ? 'pdfforge-files.zip' : 'pdfforge-file.pdf'}"`,
    );
    response.sendFile(resolved);
  } catch {
    throw new AppError('NOT_FOUND', 404, 'File not found.');
  }
}

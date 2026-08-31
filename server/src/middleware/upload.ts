import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import type { Request } from 'express';
import { AppError } from '../errors';

const root = path.resolve(process.env.TMP_DIR ?? os.tmpdir(), 'pdfforge');
const maxSize = Number(process.env.MAX_FILE_SIZE_MB ?? 50) * 1024 * 1024;
const signatures: Record<string, Buffer[]> = {
  pdf: [Buffer.from('%PDF-')],
  image: [
    Buffer.from([0xff, 0xd8, 0xff]),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('GIF8'),
    Buffer.from('RIFF'),
  ],
  docx: [Buffer.from('PK')],
  xlsx: [Buffer.from('PK')],
  pptx: [Buffer.from('PK')],
  html: [Buffer.from('<')],
};

export function sanitizeFilename(filename: string): string {
  return (
    path
      .basename(filename)
      .split('')
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('')
      .replace(/[\\/]/g, '')
      .replace(/[^a-zA-Z0-9._ -]/g, '_')
      .replace(/\s+/g, ' ')
      .slice(0, 120) || 'upload'
  );
}

export function uploadFactory(accepted: string[], multiple: boolean): multer.Multer {
  const storage = multer.diskStorage({
    destination: (_request, _file, callback) => {
      const directory = path.join(root, crypto.randomUUID());
      fs.mkdirSync(directory, { recursive: true });
      callback(null, directory);
    },
    filename: (_request, file, callback) => callback(null, sanitizeFilename(file.originalname)),
  });
  return multer({
    storage,
    limits: {
      fileSize: maxSize,
      files: multiple ? Number(process.env.MAX_FILES_PER_REQUEST ?? 10) : 1,
    },
    fileFilter: (_request, file, callback) => {
      const extension = path.extname(file.originalname).slice(1).toLowerCase();
      const acceptedExtension = accepted.some((kind) =>
        kind === 'pdf' ? extension === 'pdf' : kind === 'image'
          ? ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)
          : extension === kind,
      );
      callback(null, acceptedExtension);
    },
  });
}

function matchesSignature(buffer: Buffer, kind: string): boolean {
  return (signatures[kind] ?? []).some((signature) => buffer.subarray(0, signature.length).equals(signature));
}

export async function validateUploads(
  request: Request,
  accepted: string[],
): Promise<Express.Multer.File[]> {
  const files = (request.files as Express.Multer.File[] | undefined) ?? (request.file ? [request.file] : []);
  if (!files.length) throw new AppError('INVALID_FILE_TYPE', 400, 'Please select a PDF file.');
  for (const file of files) {
    const extension = path.extname(file.originalname).slice(1).toLowerCase();
    const kind = accepted.find((candidate) =>
      candidate === 'pdf' ? extension === 'pdf' : candidate === 'image'
        ? ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)
        : extension === candidate,
    );
    if (!kind) throw new AppError('INVALID_FILE_TYPE', 400, "This file type isn't supported.");
    const handle = await fsPromises.open(file.path, 'r');
    const header = Buffer.alloc(16);
    await handle.read(header, 0, header.length, 0);
    await handle.close();
    if (!matchesSignature(header, kind)) throw new AppError('INVALID_FILE_TYPE', 400, "This file type isn't supported.");
  }
  return files;
}

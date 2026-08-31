import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { AppError } from '../../errors';
import { renderHtmlToPdf } from './render';

const run = promisify(execFile);

async function libreOffice(input: string, output: string, workspace: string): Promise<void> {
  const profile = path.join(workspace, 'libreoffice-profile');
  const outputDirectory = path.join(workspace, 'office-output');
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.mkdir(path.join(workspace, 'home'), { recursive: true });
  try {
    await run(process.env.LIBREOFFICE_PATH || 'libreoffice', [
      '--headless', `-env:UserInstallation=file://${profile}`,
      '--convert-to', 'pdf', '--outdir', outputDirectory, input,
    ], { timeout: 120_000, env: { ...process.env, HOME: path.join(workspace, 'home') } });
  } catch (error) {
    const details = error as { code?: string };
    if (details.code === 'ENOENT') throw new AppError('ENGINE_UNAVAILABLE', 503, 'LibreOffice is unavailable on this deployment.');
    throw new AppError('PROCESSING_FAILED', 422, 'The office document could not be converted.');
  }
  const converted = path.join(outputDirectory, `${path.basename(input, path.extname(input))}.pdf`);
  try {
    await fs.rename(converted, output);
  } catch {
    throw new AppError('PROCESSING_FAILED', 422, 'LibreOffice did not produce a PDF output.');
  }
}

export async function convertOfficeToPdf(input: string, output: string, workspace: string, kind: 'word' | 'excel' | 'powerpoint'): Promise<void> {
  try {
    await libreOffice(input, output, workspace);
    return;
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== 'ENGINE_UNAVAILABLE') throw error;
  }
  if (kind === 'word' && path.extname(input).toLowerCase() === '.docx') {
    const result = await mammoth.convertToHtml({ path: input });
    await renderHtmlToPdf(output, { pageSize: 'A4', orientation: 'portrait', margin: 36, printBackground: true }, { html: result.value });
    return;
  }
  if (kind === 'excel' && path.extname(input).toLowerCase() === '.xlsx') {
    const workbook = XLSX.readFile(input);
    const html = workbook.SheetNames.map((name) => `<h1>${name}</h1>${XLSX.utils.sheet_to_html(workbook.Sheets[name])}`).join('<div style="page-break-after:always"></div>');
    await renderHtmlToPdf(output, { pageSize: 'A4', orientation: 'landscape', margin: 24, printBackground: true }, { html });
    return;
  }
  throw new AppError('ENGINE_UNAVAILABLE', 503, `No ${kind} conversion engine is available on this deployment.`);
}

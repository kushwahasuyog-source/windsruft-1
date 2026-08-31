import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface Capabilities {
  ghostscript: boolean;
  qpdf: boolean;
  libreoffice: boolean;
  poppler: boolean;
  chrome: boolean;
  ai: boolean;
  ocr: boolean;
  sharp: boolean;
  pdfaValidation: boolean;
}

async function available(binary: string, args = ['--version']): Promise<boolean> {
  try {
    await run(binary, args, { timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
}

export async function detectCapabilities(): Promise<Capabilities> {
  const binary = (key: string, fallback: string) => process.env[key] || fallback;
  const [ghostscript, qpdf, libreoffice, poppler, chrome] = await Promise.all([
    available(binary('GHOSTSCRIPT_PATH', 'gs')),
    available(binary('QPDF_PATH', 'qpdf')),
    available(binary('LIBREOFFICE_PATH', 'libreoffice')),
    available(binary('POPPLER_PATH', 'pdfinfo'), ['-v']),
    available(binary('CHROME_PATH', 'google-chrome')),
  ]);
  return {
    ghostscript,
    qpdf,
    libreoffice,
    poppler,
    chrome,
    ai: Boolean(process.env.AI_PROVIDER && process.env.AI_API_KEY),
    ocr: Boolean(process.env.OCR_LANG_PATH),
    sharp: true,
    pdfaValidation: Boolean(process.env.VERAPDF_PATH),
  };
}

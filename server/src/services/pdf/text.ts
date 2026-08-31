import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AppError } from '../../errors';

const run = promisify(execFile);

export interface PositionedWord {
  page: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function decode(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export async function positionedText(input: string): Promise<PositionedWord[]> {
  try {
    const result = await run('pdftotext', ['-bbox-layout', input, '-'], { timeout: 120_000 });
    const words: PositionedWord[] = [];
    let page = 0;
    for (const line of result.stdout.split(/\r?\n/)) {
      if (line.includes('<page ')) page += 1;
      const match = line.match(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/word>/);
      if (!match) continue;
      const [, xMin, yMin, xMax, yMax, raw] = match;
      words.push({ page, text: decode(raw), x: Number(xMin), y: Number(yMin), width: Number(xMax) - Number(xMin), height: Number(yMax) - Number(yMin) });
    }
    return words;
  } catch {
    throw new AppError('PROCESSING_FAILED', 422, 'The PDF text could not be analyzed.');
  }
}

export async function plainText(input: string): Promise<string> {
  try {
    return (await run('pdftotext', ['-layout', input, '-'], { timeout: 120_000 })).stdout;
  } catch {
    throw new AppError('PROCESSING_FAILED', 422, 'The PDF text could not be extracted.');
  }
}

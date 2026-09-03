import fs from 'node:fs/promises';
import path from 'node:path';
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';
import { AppError } from '../../errors';
import { rasterizePdf } from '../image/rasterize';
import { positionedText, type PositionedWord } from './text';

type FontName = 'Helvetica' | 'Times' | 'Courier';
const fonts = { Helvetica: StandardFonts.Helvetica, Times: StandardFonts.TimesRoman, Courier: StandardFonts.Courier } as const;
function colour(value: string): ReturnType<typeof rgb> {
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new AppError('PROCESSING_FAILED', 400, 'Colour must be a six-digit hexadecimal value.');
  return rgb(parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5), 16) / 255);
}
function pageNumber(value: unknown, count: number): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > count) throw new AppError('PROCESSING_FAILED', 400, `Page ${String(value)} is outside the document.`);
  return number;
}

export interface SignatureOptions { page: number; x: number; y: number; width: number; height: number; kind: 'image' | 'text'; text?: string; fontFamily?: FontName; fontSize?: number }
export async function signPdf(input: string, output: string, options: SignatureOptions, imagePath?: string): Promise<void> {
  const document = await PDFDocument.load(await fs.readFile(input));
  const page = document.getPages()[pageNumber(options.page, document.getPageCount()) - 1];
  if (options.kind === 'text') {
    if (!options.text?.trim()) throw new AppError('PROCESSING_FAILED', 400, 'Enter signature text.');
    const font = await document.embedFont(fonts[options.fontFamily ?? 'Helvetica']);
    page.drawText(options.text, { x: options.x, y: options.y, size: options.fontSize ?? 24, font, color: rgb(0.1, 0.1, 0.1) });
  } else {
    if (!imagePath) throw new AppError('PROCESSING_FAILED', 400, 'Select a signature image.');
    const bytes = await fs.readFile(imagePath);
    const image = imagePath.toLowerCase().endsWith('.png') ? await document.embedPng(bytes) : await document.embedJpg(bytes);
    page.drawImage(image, { x: options.x, y: options.y, width: options.width, height: options.height });
  }
  await fs.writeFile(output, await document.save());
}

export interface RedactionBox { page: number; x: number; y: number; width: number; height: number }
export async function findRedactionBoxes(input: string, searchText: string, matchCase: boolean): Promise<RedactionBox[]> {
  const words = await positionedText(input);
  const targetWords = (matchCase ? searchText : searchText.toLowerCase()).split(/\s+/).filter(Boolean);
  const byPage = new Map<number, PositionedWord[]>();
  words.forEach((word) => byPage.set(word.page, [...(byPage.get(word.page) ?? []), word]));
  const matches: RedactionBox[] = [];
  for (const [page, pageWords] of byPage) {
    const ordered = pageWords.sort((a, b) => a.y - b.y || a.x - b.x);
    for (let index = 0; index < ordered.length; index += 1) {
      const candidate = ordered.slice(index, index + targetWords.length);
      const candidateWords = candidate.map((word) => (matchCase ? word.text : word.text.toLowerCase()));
      if (candidate.length === targetWords.length && candidateWords.every((word, offset) => word === targetWords[offset])) {
        const right = candidate[candidate.length - 1];
        matches.push({ page, x: candidate[0].x, y: Math.min(...candidate.map((word) => word.y)), width: right.x + right.width - candidate[0].x, height: Math.max(...candidate.map((word) => word.y + word.height)) - Math.min(...candidate.map((word) => word.y)) });
      }
    }
  }
  return matches;
}
async function flattenPage(input: string, output: string, pageValue: number, boxes: RedactionBox[], workspace: string): Promise<void> {
  const rendered = (await rasterizePdf(input, path.join(workspace, 'redaction-raster'), { pages: [pageValue], dpi: 200, format: 'png' }))[0];
  const metadata = await sharp(rendered.path).metadata(); const document = await PDFDocument.load(await fs.readFile(input));
  const page = document.getPages()[pageValue - 1]; const width = metadata.width ?? 1; const height = metadata.height ?? 1;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${boxes.map((box) => `<rect x="${box.x * width / page.getWidth()}" y="${height - ((box.y + box.height) * height / page.getHeight())}" width="${box.width * width / page.getWidth()}" height="${box.height * height / page.getHeight()}" fill="black"/>`).join('')}</svg>`;
  await sharp(rendered.path).composite([{ input: Buffer.from(svg) }]).png().toFile(output);
}
export async function redactPdf(input: string, output: string, workspace: string, suppliedBoxes: RedactionBox[], searchText?: string, matchCase = false): Promise<void> {
  const document = await PDFDocument.load(await fs.readFile(input)); const boxes = [...suppliedBoxes, ...(searchText ? await findRedactionBoxes(input, searchText, matchCase) : [])];
  if (!boxes.length) throw new AppError('PROCESSING_FAILED', 400, 'Add a redaction box or text to find.');
  boxes.forEach((box) => pageNumber(box.page, document.getPageCount()));
  const byPage = new Map<number, RedactionBox[]>(); boxes.forEach((box) => byPage.set(box.page, [...(byPage.get(box.page) ?? []), box]));
  const result = await PDFDocument.create();
  for (let index = 0; index < document.getPageCount(); index += 1) {
    const pageValue = index + 1; const page = document.getPages()[index]; const pageBoxes = byPage.get(pageValue);
    if (!pageBoxes) { const [copy] = await result.copyPages(document, [index]); result.addPage(copy); continue; }
    const imagePath = path.join(workspace, `redacted-${pageValue}.png`); await flattenPage(input, imagePath, pageValue, pageBoxes, workspace);
    const image = await result.embedPng(await fs.readFile(imagePath)); const flattened = result.addPage([page.getWidth(), page.getHeight()]);
    flattened.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }
  await fs.writeFile(output, await result.save());
}

export interface EditOp { page: number; kind: 'text' | 'draw' | 'highlight' | 'rect' | 'ellipse' | 'image'; x?: number; y?: number; width?: number; height?: number; text?: string; color?: string; strokeWidth?: number; fontFamily?: FontName; fontSize?: number; points?: Array<{ x: number; y: number }>; rotation?: number; imageIndex?: number }
export async function editPdf(input: string, output: string, ops: EditOp[], imagePaths: Record<number, string> = {}): Promise<void> {
  const document = await PDFDocument.load(await fs.readFile(input)); const embeddedFonts = new Map<FontName, Awaited<ReturnType<typeof document.embedFont>>>();
  for (let opIndex = 0; opIndex < ops.length; opIndex += 1) {
    const op = ops[opIndex]; const page = document.getPages()[pageNumber(op.page, document.getPageCount()) - 1]; const fill = colour(op.color ?? '#111827');
    if (op.kind === 'text') {
      if (!op.text?.trim()) throw new AppError('PROCESSING_FAILED', 400, 'Text edits need content.'); const family = op.fontFamily ?? 'Helvetica'; let font = embeddedFonts.get(family);
      if (!font) { font = await document.embedFont(fonts[family]); embeddedFonts.set(family, font); }
      page.drawText(op.text, { x: op.x ?? 0, y: op.y ?? 0, size: op.fontSize ?? 18, font, color: fill });
    } else if (op.kind === 'draw' && op.points && op.points.length > 1) {
      for (let index = 1; index < op.points.length; index += 1) page.drawLine({ start: op.points[index - 1], end: op.points[index], thickness: op.strokeWidth ?? 2, color: fill });
    } else if (op.kind === 'highlight' || op.kind === 'rect') {
      page.drawRectangle({ x: op.x ?? 0, y: op.y ?? 0, width: op.width ?? 1, height: op.height ?? 1, color: fill, opacity: op.kind === 'highlight' ? 0.35 : 1, borderColor: fill, borderWidth: op.strokeWidth ?? 1 });
    } else if (op.kind === 'ellipse') {
      page.drawEllipse({ x: (op.x ?? 0) + (op.width ?? 1) / 2, y: (op.y ?? 0) + (op.height ?? 1) / 2, xScale: (op.width ?? 1) / 2, yScale: (op.height ?? 1) / 2, color: fill, opacity: 0.25, borderColor: fill, borderWidth: op.strokeWidth ?? 1 });
    } else if (op.kind === 'image') {
      const imagePath = imagePaths[op.imageIndex ?? opIndex]; if (!imagePath) throw new AppError('PROCESSING_FAILED', 400, 'Select an image for the image edit.');
      const image = imagePath.toLowerCase().endsWith('.png') ? await document.embedPng(await fs.readFile(imagePath)) : await document.embedJpg(await fs.readFile(imagePath));
      page.drawImage(image, { x: op.x ?? 0, y: op.y ?? 0, width: op.width ?? image.width, height: op.height ?? image.height, rotate: degrees(op.rotation ?? 0) });
    }
  }
  await fs.writeFile(output, await document.save());
}

export interface DiffResult { pagesAdded: number[]; pagesRemoved: number[]; pages: Array<{ page: number; status: 'added' | 'removed' | 'changed' | 'unchanged'; additions: string[]; deletions: string[] }> }
function lcsDiff(left: string[], right: string[]): { additions: string[]; deletions: string[] } {
  const matrix = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));
  for (let i = left.length - 1; i >= 0; i -= 1) for (let j = right.length - 1; j >= 0; j -= 1) matrix[i][j] = left[i] === right[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
  const additions: string[] = []; const deletions: string[] = []; let i = 0; let j = 0;
  while (i < left.length && j < right.length) { if (left[i] === right[j]) { i += 1; j += 1; } else if (matrix[i + 1][j] >= matrix[i][j + 1]) { deletions.push(left[i]); i += 1; } else { additions.push(right[j]); j += 1; } }
  deletions.push(...left.slice(i)); additions.push(...right.slice(j)); return { additions, deletions };
}
export async function comparePdf(leftPath: string, rightPath: string, maxWords = 100_000): Promise<DiffResult | { tooLarge: true; message: string }> {
  const [left, right] = await Promise.all([positionedText(leftPath), positionedText(rightPath)]); if (left.length + right.length > maxWords) return { tooLarge: true, message: 'Document too large to diff fully.' };
  const leftPages = new Map<number, string[]>(); const rightPages = new Map<number, string[]>();
  left.forEach((word) => leftPages.set(word.page, [...(leftPages.get(word.page) ?? []), word.text])); right.forEach((word) => rightPages.set(word.page, [...(rightPages.get(word.page) ?? []), word.text]));
  const maxPage = Math.max(...leftPages.keys(), ...rightPages.keys(), 0); const pages: DiffResult['pages'] = [];
  for (let page = 1; page <= maxPage; page += 1) { const a = leftPages.get(page); const b = rightPages.get(page); if (!a) pages.push({ page, status: 'added', additions: b ?? [], deletions: [] }); else if (!b) pages.push({ page, status: 'removed', additions: [], deletions: a }); else { const diff = lcsDiff(a, b); pages.push({ page, status: diff.additions.length || diff.deletions.length ? 'changed' : 'unchanged', ...diff }); } }
  return { pagesAdded: pages.filter((page) => page.status === 'added').map((page) => page.page), pagesRemoved: pages.filter((page) => page.status === 'removed').map((page) => page.page), pages };
}
export function markdownFromWords(words: PositionedWord[]): string {
  const pages = new Map<number, PositionedWord[]>(); words.forEach((word) => pages.set(word.page, [...(pages.get(word.page) ?? []), word])); const output: string[] = [];
  for (const [page, pageWords] of pages) {
    const lines = new Map<number, PositionedWord[]>(); pageWords.forEach((word) => { const key = Math.round(word.y / 4) * 4; lines.set(key, [...(lines.get(key) ?? []), word]); });
    const orderedLines = [...lines.values()].sort((a, b) => a[0].y - b[0].y).map((line) => line.sort((a, b) => a.x - b.x));
    const tableLines = orderedLines.filter((line) => line.length >= 2 && line.length <= 8 && line[line.length - 1].x - line[0].x > 100);
    if (tableLines.length >= 2) {
      const columns = tableLines[0].length;
      output.push(`| ${tableLines[0].map((word) => word.text).join(' | ')} |`, `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`);
      tableLines.slice(1).forEach((line) => output.push(`| ${line.slice(0, columns).map((word) => word.text).join(' | ')} |`));
    } else {
      for (const line of orderedLines) { const text = line.map((word) => word.text).join(' '); if (/^[-•]\s/.test(text)) output.push(`- ${text.replace(/^[-•]\s*/, '')}`); else if (/^\d+[.)]\s/.test(text)) output.push(text.replace(/^(\d+)[.)]\s*/, '$1. ')); else if (line.length <= 10 && text.length < 100 && (text === text.toUpperCase() || page === 1 && output.length === 0)) output.push(`## ${text}`); else output.push(text); }
    }
    if (page < Math.max(...pages.keys())) output.push('\n---\n');
  }
  return `${output.join('\n')}\n`;
}

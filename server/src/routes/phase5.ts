import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../errors';
import { uploadFactory, validateUploads } from '../middleware/upload';
import { createWorkspace, registerResult } from '../services/storage/workspace';
import { comparePdf, editPdf, findRedactionBoxes, markdownFromWords, redactPdf, signPdf } from '../services/pdf/phase5';
import { inspectForms, modifyForms, type FormFieldInput } from '../services/pdf/forms';
import { positionedText, plainText } from '../services/pdf/text';
import { runAi } from '../services/ai';

const router = Router();
const onePdf = uploadFactory(['pdf'], false);
const twoPdfs = uploadFactory(['pdf'], true);
const signatureUpload = uploadFactory(['pdf', 'image'], true);
const editUpload = uploadFactory(['pdf', 'image'], true);

async function result(workspace: { jobId: string; directory: string }, source: string, name: string): Promise<Record<string, string>> {
  const fileId = crypto.randomUUID();
  await fs.rename(source, path.join(workspace.directory, fileId));
  await registerResult(workspace.directory, fileId, name);
  return { fileId, name, downloadUrl: `/api/files/${workspace.jobId}/${fileId}` };
}
function bodyJson<T>(value: unknown, schema: z.ZodType<T>, message: string): T {
  try { return schema.parse(JSON.parse(String(value))); } catch { throw new AppError('PROCESSING_FAILED', 400, message); }
}

router.post('/sign', signatureUpload.array('files'), async (request, response, next) => {
  try {
    const files = await validateUploads(request, ['pdf', 'image']); const pdf = files.find((file) => path.extname(file.originalname).toLowerCase() === '.pdf');
    if (!pdf) throw new AppError('INVALID_FILE_TYPE', 400, 'Select a PDF file.');
    const options = z.object({
      page: z.coerce.number().int().positive(), x: z.coerce.number().finite(), y: z.coerce.number().finite(),
      width: z.coerce.number().positive(), height: z.coerce.number().positive(), kind: z.enum(['image', 'text']),
      text: z.string().optional(), fontFamily: z.enum(['Helvetica', 'Times', 'Courier']).optional(), fontSize: z.coerce.number().min(6).max(160).optional(),
    }).parse(request.body);
    const image = files.find((file) => file !== pdf);
    const workspace = await createWorkspace(); const output = path.join(workspace.directory, 'signed.pdf');
    await signPdf(pdf.path, output, options, image?.path);
    response.json({ jobId: workspace.jobId, files: [await result(workspace, output, 'signed.pdf')] });
  } catch (error) { next(error); }
});

router.post('/redact', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const boxes = bodyJson(request.body.boxes ?? '[]', z.array(z.object({ page: z.number().int().positive(), x: z.number().finite(), y: z.number().finite(), width: z.number().positive(), height: z.number().positive() })), 'Enter valid redaction boxes.');
    const searchText = typeof request.body.searchText === 'string' && request.body.searchText.trim() ? request.body.searchText.trim() : undefined;
    const matchCase = request.body.matchCase === true || request.body.matchCase === 'true';
    const workspace = await createWorkspace(); const output = path.join(workspace.directory, 'redacted.pdf');
    await redactPdf(file.path, output, workspace.directory, boxes, searchText, matchCase);
    response.json({ jobId: workspace.jobId, files: [await result(workspace, output, 'redacted.pdf')] });
  } catch (error) { next(error); }
});

router.post('/redact/matches', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']);
    const searchText = z.string().min(1).parse(request.body.searchText);
    const matchCase = request.body.matchCase === true || request.body.matchCase === 'true';
    response.json({ boxes: await findRedactionBoxes(file.path, searchText, matchCase) });
  } catch (error) { next(error); }
});

router.post('/compare', twoPdfs.array('files'), async (request, response, next) => {
  try {
    const files = await validateUploads(request, ['pdf']); if (files.length !== 2) throw new AppError('PROCESSING_FAILED', 400, 'Select exactly two PDF files.');
    const report = await comparePdf(files[0].path, files[1].path);
    const workspace = await createWorkspace(); const output = path.join(workspace.directory, 'comparison.json');
    await fs.writeFile(output, JSON.stringify(report, null, 2));
    response.json({ ...report, jobId: workspace.jobId, files: [await result(workspace, output, 'comparison.json')] });
  } catch (error) { next(error); }
});

router.post('/forms', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']); const mode = z.enum(['detect', 'fill']).parse(request.body.mode ?? 'detect');
    if (mode === 'detect') { response.json({ fields: await inspectForms(file.path) }); return; }
    const values = bodyJson(request.body.values ?? '{}', z.record(z.union([z.string(), z.boolean()])), 'Enter valid field values.');
    const fields = bodyJson(request.body.fields ?? '[]', z.array(z.object({
      name: z.string().min(1), type: z.enum(['text', 'checkbox', 'radio', 'dropdown', 'signature-placeholder']),
      page: z.number().int().positive(), x: z.number().finite(), y: z.number().finite(), width: z.number().positive(), height: z.number().positive(), options: z.array(z.string()).optional(),
    })), 'Enter valid fields.') as FormFieldInput[];
    const workspace = await createWorkspace(); const output = path.join(workspace.directory, 'filled-form.pdf');
    await modifyForms(file.path, output, values, request.body.flatten === true || request.body.flatten === 'true', fields);
    response.json({ jobId: workspace.jobId, files: [await result(workspace, output, 'filled-form.pdf')] });
  } catch (error) { next(error); }
});

router.post('/edit', editUpload.array('files'), async (request, response, next) => {
  try {
    const files = await validateUploads(request, ['pdf', 'image']); const pdf = files.find((file) => path.extname(file.originalname).toLowerCase() === '.pdf');
    if (!pdf) throw new AppError('INVALID_FILE_TYPE', 400, 'Select a PDF file.');
    const ops = bodyJson(request.body.ops, z.array(z.object({
      page: z.number().int().positive(), kind: z.enum(['text', 'draw', 'highlight', 'rect', 'ellipse', 'image']),
      x: z.number().finite().optional(), y: z.number().finite().optional(), width: z.number().positive().optional(), height: z.number().positive().optional(),
      text: z.string().optional(), color: z.string().optional(), strokeWidth: z.number().positive().optional(), fontFamily: z.enum(['Helvetica', 'Times', 'Courier']).optional(), fontSize: z.number().positive().optional(),
      points: z.array(z.object({ x: z.number(), y: z.number() })).optional(), rotation: z.number().optional(), imageIndex: z.number().int().nonnegative().optional(),
    })), 'Enter valid edit operations.');
    const images: Record<number, string> = {}; files.filter((file) => file !== pdf).forEach((file, index) => { images[index] = file.path; });
    const workspace = await createWorkspace(); const output = path.join(workspace.directory, 'edited.pdf');
    await editPdf(pdf.path, output, ops, images);
    response.json({ jobId: workspace.jobId, files: [await result(workspace, output, 'edited.pdf')] });
  } catch (error) { next(error); }
});

router.post('/to-markdown', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']); const markdown = markdownFromWords(await positionedText(file.path));
    const workspace = await createWorkspace(); const output = path.join(workspace.directory, 'document.md'); await fs.writeFile(output, markdown);
    response.json({ jobId: workspace.jobId, files: [await result(workspace, output, 'document.md')] });
  } catch (error) { next(error); }
});

router.post('/ai/summarize', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']); const length = z.enum(['short', 'medium', 'detailed']).parse(request.body.length ?? 'medium');
    const text = await plainText(file.path); const chunks = text.match(/[\s\S]{1,12000}/g) ?? ['']; const selected = chunks.slice(0, 8);
    const notes: string[] = []; for (const chunk of selected) notes.push(await runAi({ system: 'Summarize the supplied document excerpt.', prompt: chunk, maxTokens: length === 'detailed' ? 1200 : 700 }));
    const final = await runAi({ system: 'Return JSON with overview, summary, keyPoints array, and importantSections array containing heading, page, note.', prompt: notes.join('\n\n'), maxTokens: length === 'detailed' ? 2000 : 1000 });
    const workspace = await createWorkspace(); const output = path.join(workspace.directory, 'summary.json'); await fs.writeFile(output, final);
    response.json({ jobId: workspace.jobId, files: [await result(workspace, output, 'summary.json')] });
  } catch (error) { next(error); }
});

router.post('/ai/translate', onePdf.single('file'), async (request, response, next) => {
  try {
    const [file] = await validateUploads(request, ['pdf']); const sourceLanguage = z.string().min(2).max(20).parse(request.body.sourceLanguage ?? 'auto'); const targetLanguage = z.string().min(2).max(20).parse(request.body.targetLanguage);
    const text = await plainText(file.path); const chunks = text.match(/[\s\S]{1,12000}/g) ?? ['']; const translated: string[] = [];
    for (const chunk of chunks.slice(0, 8)) translated.push(await runAi({ system: `Translate from ${sourceLanguage} to ${targetLanguage}. Preserve paragraph breaks.`, prompt: chunk, maxTokens: 1800 }));
    const workspace = await createWorkspace(); const output = path.join(workspace.directory, 'translated.txt'); await fs.writeFile(output, translated.join('\n\n'));
    response.json({ jobId: workspace.jobId, files: [await result(workspace, output, 'translated.txt')] });
  } catch (error) { next(error); }
});

export default router;

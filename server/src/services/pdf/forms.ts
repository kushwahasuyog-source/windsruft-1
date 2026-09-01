import fs from 'node:fs/promises';
import { PDFDocument, rgb } from 'pdf-lib';
import { AppError } from '../../errors';

export interface FormFieldInput { name: string; type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'signature-placeholder'; page: number; x: number; y: number; width: number; height: number; options?: string[] }
export async function inspectForms(input: string): Promise<Array<Record<string, unknown>>> {
  const document = await PDFDocument.load(await fs.readFile(input)); const form = document.getForm();
  return form.getFields().map((field) => {
    const widget = field.acroField.getWidgets()[0]; const rect = widget?.getRectangle(); const pageRef = widget?.P(); const page = pageRef ? document.getPages().findIndex((candidate) => candidate.ref === pageRef) + 1 : undefined;
    let value: string | boolean | undefined;
    if (field.constructor.name === 'PDFTextField') value = form.getTextField(field.getName()).getText();
    else if (field.constructor.name === 'PDFCheckBox') value = form.getCheckBox(field.getName()).isChecked();
    return { name: field.getName(), type: field.constructor.name.replace(/^PDF|Field$/g, '').toLowerCase(), value, page, rect };
  });
}
export async function modifyForms(input: string, output: string, values: Record<string, string | boolean>, flatten: boolean, fields: FormFieldInput[]): Promise<void> {
  const document = await PDFDocument.load(await fs.readFile(input)); const form = document.getForm();
  for (const field of fields) {
    const page = document.getPages()[field.page - 1]; if (!page) throw new AppError('PROCESSING_FAILED', 400, `Page ${field.page} is outside the document.`);
    let existing = true;
    try { form.getField(field.name); } catch { existing = false; }
    if (!existing && field.type === 'text') form.createTextField(field.name).addToPage(page, { x: field.x, y: field.y, width: field.width, height: field.height, borderColor: rgb(0, 0, 0) });
    else if (!existing && field.type === 'checkbox') form.createCheckBox(field.name).addToPage(page, { x: field.x, y: field.y, width: field.width, height: field.height });
    else if (!existing && field.type === 'radio') form.createRadioGroup(field.name).addOptionToPage(field.options?.[0] ?? 'Option 1', page, { x: field.x, y: field.y, width: field.width, height: field.height });
    else if (!existing && field.type === 'dropdown') { const dropdown = form.createDropdown(field.name); dropdown.addOptions(field.options ?? []); dropdown.addToPage(page, { x: field.x, y: field.y, width: field.width, height: field.height }); }
    else if (!existing) form.createTextField(field.name).addToPage(page, { x: field.x, y: field.y, width: field.width, height: field.height });
  }
  for (const [name, value] of Object.entries(values)) { const field = form.getField(name); if (field.constructor.name === 'PDFTextField') form.getTextField(name).setText(String(value)); else if (field.constructor.name === 'PDFCheckBox') { if (value) form.getCheckBox(name).check(); else form.getCheckBox(name).uncheck(); } else if (field.constructor.name === 'PDFDropdown') form.getDropdown(name).select(String(value)); }
  if (flatten) form.flatten(); await fs.writeFile(output, await document.save());
}

export type ToolCategory =
  | 'ORGANIZE PDF'
  | 'OPTIMIZE PDF'
  | 'CONVERT TO PDF'
  | 'CONVERT FROM PDF'
  | 'EDIT PDF'
  | 'PDF SECURITY'
  | 'PDF INTELLIGENCE';

export type ToolStatus = 'ready' | 'planned';
export type AcceptedType = 'pdf' | 'image' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'ppt' | 'pptx' | 'html';

export interface ToolDefinition {
  slug: string;
  name: string;
  path: `/tool/${string}`;
  description: string;
  category: ToolCategory;
  status: ToolStatus;
  accepts: AcceptedType[];
  multiple: boolean;
  icon: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface ResultFile {
  fileId: string;
  name: string;
  originalSize?: number;
  compressedSize?: number;
  savedPercent?: number;
  downloadUrl: string;
  engine?: string;
}

export interface JobResponse {
  jobId: string;
  files: ResultFile[];
  downloadAllUrl?: string;
}

export const categories: ToolCategory[] = [
  'ORGANIZE PDF',
  'OPTIMIZE PDF',
  'CONVERT TO PDF',
  'CONVERT FROM PDF',
  'EDIT PDF',
  'PDF SECURITY',
  'PDF INTELLIGENCE',
];

const specs: Array<[string, string, string, ToolCategory, AcceptedType[], boolean, string]> = [
  ['merge-pdf', 'Merge PDF', 'Combine multiple PDFs in your chosen order.', 'ORGANIZE PDF', ['pdf'], true, 'layers'],
  ['split-pdf', 'Split PDF', 'Separate pages or ranges into focused documents.', 'ORGANIZE PDF', ['pdf'], false, 'scissors'],
  ['remove-pages', 'Remove Pages', 'Trim pages you no longer need.', 'ORGANIZE PDF', ['pdf'], false, 'minus'],
  ['extract-pages', 'Extract Pages', 'Pull selected pages into a new PDF.', 'ORGANIZE PDF', ['pdf'], false, 'extract'],
  ['organize-pdf', 'Organize PDF', 'Reorder and arrange a document with ease.', 'ORGANIZE PDF', ['pdf'], false, 'grid'],
  ['scan-to-pdf', 'Scan to PDF', 'Turn scans into a polished PDF.', 'ORGANIZE PDF', ['image'], true, 'scan'],
  ['compress-pdf', 'Compress PDF', 'Shrink PDF size while keeping it useful.', 'OPTIMIZE PDF', ['pdf'], true, 'compress'],
  ['repair-pdf', 'Repair PDF', 'Recover readable documents from damaged files.', 'OPTIMIZE PDF', ['pdf'], false, 'repair'],
  ['ocr-pdf', 'OCR PDF', 'Make scanned pages searchable.', 'OPTIMIZE PDF', ['pdf'], false, 'text'],
  ['jpg-to-pdf', 'JPG to PDF', 'Build a PDF from your images.', 'CONVERT TO PDF', ['image'], true, 'image'],
  ['word-to-pdf', 'Word to PDF', 'Convert Word documents into PDFs.', 'CONVERT TO PDF', ['doc', 'docx'], true, 'doc'],
  ['powerpoint-to-pdf', 'PowerPoint to PDF', 'Share presentations as PDFs.', 'CONVERT TO PDF', ['ppt', 'pptx'], true, 'presentation'],
  ['excel-to-pdf', 'Excel to PDF', 'Export spreadsheets as PDFs.', 'CONVERT TO PDF', ['xls', 'xlsx'], true, 'sheet'],
  ['html-to-pdf', 'HTML to PDF', 'Create a PDF from a web page.', 'CONVERT TO PDF', ['html'], false, 'web'],
  ['pdf-to-jpg', 'PDF to JPG', 'Turn PDF pages into crisp images.', 'CONVERT FROM PDF', ['pdf'], false, 'image'],
  ['pdf-to-word', 'PDF to Word', 'Make PDF content editable in Word.', 'CONVERT FROM PDF', ['pdf'], false, 'doc'],
  ['pdf-to-powerpoint', 'PDF to PowerPoint', 'Transform PDFs into presentations.', 'CONVERT FROM PDF', ['pdf'], false, 'presentation'],
  ['pdf-to-excel', 'PDF to Excel', 'Extract tables into spreadsheets.', 'CONVERT FROM PDF', ['pdf'], false, 'sheet'],
  ['pdf-to-pdfa', 'PDF to PDF/A', 'Prepare a PDF for long-term archiving.', 'CONVERT FROM PDF', ['pdf'], false, 'archive'],
  ['rotate-pdf', 'Rotate PDF', 'Turn pages to the right orientation.', 'EDIT PDF', ['pdf'], false, 'rotate'],
  ['add-page-numbers', 'Add Page Numbers', 'Give every page a clear position.', 'EDIT PDF', ['pdf'], false, 'numbers'],
  ['add-watermark', 'Add Watermark', 'Add a subtle mark to your pages.', 'EDIT PDF', ['pdf'], false, 'watermark'],
  ['crop-pdf', 'Crop PDF', 'Focus pages by trimming their edges.', 'EDIT PDF', ['pdf'], false, 'crop'],
  ['edit-pdf', 'Edit PDF', 'Make quick edits directly on a page.', 'EDIT PDF', ['pdf'], false, 'edit'],
  ['pdf-forms', 'PDF Forms', 'Fill and prepare interactive forms.', 'EDIT PDF', ['pdf'], false, 'form'],
  ['unlock-pdf', 'Unlock PDF', 'Work with a PDF you have permission to open.', 'PDF SECURITY', ['pdf'], false, 'unlock'],
  ['protect-pdf', 'Protect PDF', 'Set a password for sensitive documents.', 'PDF SECURITY', ['pdf'], false, 'lock'],
  ['sign-pdf', 'Sign PDF', 'Add your signature to a document.', 'PDF SECURITY', ['pdf'], false, 'sign'],
  ['redact-pdf', 'Redact PDF', 'Permanently hide sensitive details.', 'PDF SECURITY', ['pdf'], false, 'redact'],
  ['compare-pdf', 'Compare PDF', 'Spot changes between two documents.', 'PDF SECURITY', ['pdf'], true, 'compare'],
  ['ai-summarizer', 'AI Summarizer', 'Get the key points from a document.', 'PDF INTELLIGENCE', ['pdf'], false, 'spark'],
  ['translate-pdf', 'Translate PDF', 'Understand documents in another language.', 'PDF INTELLIGENCE', ['pdf'], false, 'translate'],
  ['pdf-to-markdown', 'PDF to Markdown', 'Turn PDF structure into clean Markdown.', 'PDF INTELLIGENCE', ['pdf'], false, 'markdown'],
];

const readySlugs = new Set([
  'compress-pdf',
  'merge-pdf',
  'split-pdf',
  'rotate-pdf',
  'remove-pages',
  'extract-pages',
  'organize-pdf',
  'add-page-numbers',
  'add-watermark',
  'crop-pdf',
  'unlock-pdf',
  'protect-pdf',
  'repair-pdf',
  'jpg-to-pdf',
  'scan-to-pdf',
  'word-to-pdf',
  'powerpoint-to-pdf',
  'excel-to-pdf',
  'html-to-pdf',
  'pdf-to-jpg',
  'pdf-to-word',
  'pdf-to-powerpoint',
  'pdf-to-excel',
  'pdf-to-pdfa',
  'ocr-pdf',
]);
export const toolRegistry: ToolDefinition[] = specs.map(([slug, name, description, category, accepts, multiple, icon]) => ({
  slug,
  name,
  description,
  category,
  accepts,
  multiple,
  icon,
  path: `/tool/${slug}`,
  status: readySlugs.has(slug) ? 'ready' : 'planned',
}));

export const getTool = (slug: string): ToolDefinition | undefined => toolRegistry.find((tool) => tool.slug === slug);

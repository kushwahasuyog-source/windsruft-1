import type { ToolModule } from './types';

export async function loadToolModule(slug: string): Promise<ToolModule | undefined> {
  switch (slug) {
    case 'compress-pdf': return (await import('./compress')).default;
    case 'merge-pdf': return (await import('./merge')).default;
    case 'split-pdf': return (await import('./split')).default;
      case 'rotate-pdf': return (await import('./rotate')).default;
      case 'remove-pages': return (await import('./remove-pages')).default;
      case 'extract-pages': return (await import('./extract-pages')).default;
      case 'organize-pdf': return (await import('./organize-pdf')).default;
      case 'add-page-numbers': return (await import('./add-page-numbers')).default;
      case 'add-watermark': return (await import('./add-watermark')).default;
      case 'crop-pdf': return (await import('./crop-pdf')).default;
      case 'protect-pdf': return (await import('./protect-pdf')).default;
      case 'unlock-pdf': return (await import('./unlock-pdf')).default;
      case 'jpg-to-pdf': return (await import('./jpg-to-pdf')).default;
      case 'scan-to-pdf': return (await import('./scan-to-pdf')).default;
      case 'word-to-pdf': return (await import('./word-to-pdf')).default;
      case 'powerpoint-to-pdf': return (await import('./powerpoint-to-pdf')).default;
      case 'excel-to-pdf': return (await import('./excel-to-pdf')).default;
      case 'html-to-pdf': return (await import('./html-to-pdf')).default;
      case 'pdf-to-jpg': return (await import('./pdf-to-jpg')).default;
      case 'pdf-to-word': return (await import('./pdf-to-word')).default;
      case 'pdf-to-powerpoint': return (await import('./pdf-to-powerpoint')).default;
      case 'pdf-to-excel': return (await import('./pdf-to-excel')).default;
      case 'pdf-to-pdfa': return (await import('./pdf-to-pdfa')).default;
      case 'repair-pdf': return (await import('./repair-pdf')).default;
      case 'ocr-pdf': return (await import('./ocr-pdf')).default;
    default: return undefined;
  }
}

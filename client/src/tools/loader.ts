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
    default: return undefined;
  }
}

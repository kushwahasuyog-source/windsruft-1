import type { ToolModule } from './types';

export async function loadToolModule(slug: string): Promise<ToolModule | undefined> {
  switch (slug) {
    case 'compress-pdf': return (await import('./compress')).default;
    case 'merge-pdf': return (await import('./merge')).default;
    case 'split-pdf': return (await import('./split')).default;
    case 'rotate-pdf': return (await import('./rotate')).default;
    default: return undefined;
  }
}

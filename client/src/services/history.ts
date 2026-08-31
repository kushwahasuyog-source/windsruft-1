export interface HistoryEntry {
  id: string;
  fileName: string;
  tool: string;
  date: string;
  status: 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt: string;
}

const historyKey = 'pdfforge-history';
const favoritesKey = 'pdfforge-favorites';
const maxEntries = 50;

export function getHistory(): HistoryEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem(historyKey) ?? '[]') as HistoryEntry[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function addHistory(entry: Omit<HistoryEntry, 'id' | 'date'>): void {
  const next: HistoryEntry = { ...entry, id: crypto.randomUUID(), date: new Date().toISOString() };
  localStorage.setItem(historyKey, JSON.stringify([next, ...getHistory()].slice(0, maxEntries)));
}

export function getFavorites(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(favoritesKey) ?? '[]') as string[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(slug: string): string[] {
  const current = getFavorites();
  const next = current.includes(slug) ? current.filter((value) => value !== slug) : [...current, slug];
  localStorage.setItem(favoritesKey, JSON.stringify(next));
  return next;
}

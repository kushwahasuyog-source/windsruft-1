import { useEffect, useState } from 'react';
import type { ToolModule, ToolSettingsProps } from '../types';
import { Card } from '../../components/ui/Primitives';
import { PdfPreview } from '../../components/PdfPreview';

interface DiffPage { page: number; status: string; additions: string[]; deletions: string[] }
interface DiffReport { pagesAdded?: number[]; pagesRemoved?: number[]; pages?: DiffPage[]; message?: string }

function Settings({ items }: ToolSettingsProps) {
  const [report, setReport] = useState<DiffReport>();
  useEffect(() => {
    const file = items[0]?.result?.files.find((entry) => entry.name === 'comparison.json');
    if (!file) return;
    void fetch(`${file.downloadUrl}?inline=1`).then((response) => response.json() as Promise<DiffReport>).then(setReport).catch(() => undefined);
  }, [items]);
  const added = new Set(report?.pagesAdded ?? []);
  const removed = new Set(report?.pagesRemoved ?? []);
  const rows = report?.pages?.map((entry) => ({ ...entry, inA: !added.has(entry.page), inB: !removed.has(entry.page) })) ?? [];
  return <Card className="mt-6 space-y-4">
    <p className="text-sm text-secondary">Add document A and B. Each page is aligned side by side with its status badge; changed pages show the word-level diff inline.</p>
    {report?.message && !report.pages && <p className="text-danger">{report.message}</p>}
    {rows.length > 0 && <div className="space-y-4" aria-label="Comparison report">{rows.map((entry) => <div key={entry.page} className="rounded border border-subtle p-3">
      <div className="flex items-center gap-2"><span className="font-semibold">Page {entry.page}</span><span className={`rounded px-2 py-1 text-xs font-bold uppercase ${entry.status === 'unchanged' ? 'bg-sunken text-muted' : entry.status === 'changed' ? 'bg-accent/15 text-accent' : 'bg-danger/15 text-danger'}`}>{entry.status}</span></div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div><p className="mb-1 text-xs font-semibold uppercase text-muted">Document A</p>{entry.inA && items[0] ? <PdfPreview file={items[0].file} page={entry.page} compact /> : <p className="rounded border border-dashed border-subtle p-6 text-center text-sm text-muted">Not present in A</p>}</div>
        <div><p className="mb-1 text-xs font-semibold uppercase text-muted">Document B</p>{entry.inB && items[1] ? <PdfPreview file={items[1].file} page={entry.page} compact /> : <p className="rounded border border-dashed border-subtle p-6 text-center text-sm text-muted">Not present in B</p>}</div>
      </div>
      {(entry.deletions.length > 0 || entry.additions.length > 0) && <div className="mt-3 flex flex-wrap gap-2 text-sm">{entry.deletions.map((word, index) => <del key={`d-${index}`} className="rounded bg-danger/15 px-1 text-danger">{word}</del>)}{entry.additions.map((word, index) => <ins key={`a-${index}`} className="rounded bg-accent/15 px-1 text-accent no-underline">{word}</ins>)}</div>}
    </div>)}</div>}
    {rows.length === 0 && items.length >= 2 && <div className="grid gap-4 md:grid-cols-2"><div><p className="mb-2 font-semibold">Document A</p><PdfPreview file={items[0].file} compact /></div><div><p className="mb-2 font-semibold">Document B</p><PdfPreview file={items[1].file} compact /></div></div>}
  </Card>;
}
const module: ToolModule = { Settings, buildRequest: (settings) => ({ operation: 'compare', options: { ...settings } }) };
export default module;

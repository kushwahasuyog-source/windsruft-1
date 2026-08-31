import { useEffect, useState, type ReactNode } from 'react';
import { PdfPreview } from '../components/PdfPreview';
import { Button, Card } from '../components/ui/Primitives';
import type { ToolSettingsProps } from './types';

export function parsePageList(value: string, count: number): number[] {
  const pages: number[] = [];
  for (const token of value.split(',').map((part) => part.trim()).filter(Boolean)) {
    const parts = token.split('-').map(Number);
    if (parts.length > 2 || parts.some((part) => !Number.isInteger(part))) return [];
    const [start, end = start] = parts;
    if (start < 1 || end < start || end > count) return [];
    for (let page = start; page <= end; page += 1) pages.push(page);
  }
  return [...new Set(pages)];
}

export function pageListText(pages: number[]): string {
  return pages.join(',');
}

export function SelectionPanel({
  items,
  settings,
  onChange,
  label = 'Select pages',
  children,
  onPageCount,
}: ToolSettingsProps & { label?: string; children?: ReactNode; onPageCount?: (count: number) => void }) {
  const file = items[0]?.file;
  const selected = settings.pages ? JSON.parse(String(settings.pages)) as number[] : [];
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!file) setCount(0);
  }, [file]);
  const update = (pages: number[]) => onChange('pages', JSON.stringify([...new Set(pages)].sort((a, b) => a - b)));
  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{label}</h2>
        <div className="flex gap-2">
          <Button className="border border-subtle text-sm" onClick={() => update(Array.from({ length: count }, (_value, index) => index + 1))} disabled={!count}>Select all</Button>
          <Button className="border border-subtle text-sm" onClick={() => update([])}>Select none</Button>
        </div>
      </div>
      {file && (
        <PdfPreview
          file={file}
          selectable
          selected={selected}
          onPageCount={(pages) => {
            setCount(pages);
            onPageCount?.(pages);
          }}
          onSelectionChange={update}
        />
      )}
      <p className="mt-2 text-sm text-muted">{selected.length} of {count || '…'} pages selected.</p>
      {children}
    </Card>
  );
}

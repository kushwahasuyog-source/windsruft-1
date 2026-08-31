import { useEffect, useMemo } from 'react';
import { Card } from '../components/ui/Primitives';
import type { ToolSettingsProps } from './types';

export function ImageOrderSettings({ items, settings, onChange, title = 'Image order' }: ToolSettingsProps & { title?: string }) {
  const order = settings.order ? JSON.parse(String(settings.order)) as number[] : items.map((_item, index) => index);
  const ordered = order.map((index) => items[index]).filter(Boolean);
  const urls = useMemo(() => ordered.map((item) => URL.createObjectURL(item.file)), [ordered]);
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
  const move = (index: number, direction: -1 | 1) => {
    const next = [...order];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange('order', JSON.stringify(next));
  };
  useEffect(() => {
    if (!settings.order && items.length) onChange('order', JSON.stringify(items.map((_item, index) => index)));
  }, [items, onChange, settings.order]);
  return (
    <Card className="mt-6">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-secondary">Reorder with the buttons; the displayed order is the order used in the PDF.</p>
      <div className="mt-4 space-y-2">
        {ordered.map((item, index) => (
          <div key={item.id} className="flex items-center gap-3 rounded-lg border border-subtle p-2">
            <img src={urls[index]} alt="" className="h-16 w-12 rounded object-cover" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.file.name}</span>
            <button type="button" className="rounded border border-subtle px-3 py-2 text-sm" aria-label={`Move ${item.file.name} up`} onClick={() => move(index, -1)} disabled={index === 0}>↑</button>
            <button type="button" className="rounded border border-subtle px-3 py-2 text-sm" aria-label={`Move ${item.file.name} down`} onClick={() => move(index, 1)} disabled={index === ordered.length - 1}>↓</button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function PdfOutputSettings({ settings, onChange, image = false }: Pick<ToolSettingsProps, 'settings' | 'onChange'> & { image?: boolean }) {
  return (
    <Card className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-semibold">Page size<select className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal" value={String(settings.pageSize ?? 'A4')} onChange={(event) => onChange('pageSize', event.target.value)}><option>A4</option><option>Letter</option><option>fit</option></select></label>
      <label className="text-sm font-semibold">Orientation<select className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal" value={String(settings.orientation ?? 'auto')} onChange={(event) => onChange('orientation', event.target.value)}><option>auto</option><option>portrait</option><option>landscape</option></select></label>
      <label className="text-sm font-semibold">Margin (pt)<input className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal" type="number" min="0" max="144" value={Number(settings.margin ?? 24)} onChange={(event) => onChange('margin', Number(event.target.value))} /></label>
      <label className="text-sm font-semibold">Fit mode<select className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal" value={String(settings.fitMode ?? 'contain')} onChange={(event) => onChange('fitMode', event.target.value)}><option>contain</option><option>cover</option></select></label>
      {image && <p className="text-sm text-muted sm:col-span-2 lg:col-span-4">Images are normalized through the server, including EXIF rotation and metadata removal.</p>}
    </Card>
  );
}

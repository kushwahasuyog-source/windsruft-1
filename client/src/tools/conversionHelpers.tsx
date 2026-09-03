import { useEffect, useMemo } from 'react';
import { Card } from '../components/ui/Primitives';
import { SortableList } from '../components/SortableList';
import type { ToolSettingsProps } from './types';

export function ImageOrderSettings({ items, settings, onChange, title = 'Image order' }: ToolSettingsProps & { title?: string }) {
  const order = settings.order ? JSON.parse(String(settings.order)) as number[] : items.map((_item, index) => index);
  const ordered = order.map((index) => items[index]).filter(Boolean);
  const urls = useMemo(() => ordered.map((item) => URL.createObjectURL(item.file)), [ordered]);
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
  useEffect(() => {
    if (!settings.order && items.length) onChange('order', JSON.stringify(items.map((_item, index) => index)));
  }, [items, onChange, settings.order]);
  return (
    <Card className="mt-6">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-secondary">Drag items to reorder; the displayed order is the order used in the PDF. Keyboard users can use the move buttons.</p>
      <div className="mt-4">
        <SortableList
          items={ordered}
          onReorder={(from, to) => {
            if (to < 0 || to >= order.length) return;
            const next = [...order];
            [next[from], next[to]] = [next[to], next[from]];
            onChange('order', JSON.stringify(next));
          }}
          renderItem={(item, index) => (
            <div className="flex items-center gap-3 p-2">
              <img src={urls[index]} alt="" className="h-16 w-12 rounded object-cover" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.file.name}</span>
            </div>
          )}
        />
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

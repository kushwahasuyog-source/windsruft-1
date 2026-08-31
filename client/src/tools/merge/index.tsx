import { useMemo, useState } from 'react';
import type { ToolModule, ToolRequest } from '../types';
import type { ToolSettingsProps } from '../types';
import { PdfPreview } from '../../components/PdfPreview';
import { Button, Card } from '../../components/ui/Primitives';

function Settings({ items, settings, onChange }: ToolSettingsProps) {
  const ids = useMemo(() => {
    const saved = String(settings.order ?? '');
    const known = new Set(items.map((item) => item.id));
    const fromSettings = saved ? saved.split(',').filter((id) => known.has(id)) : [];
    return [...fromSettings, ...items.map((item) => item.id).filter((id) => !fromSettings.includes(id))];
  }, [items, settings.order]);
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const move = (id: string, direction: -1 | 1) => {
    const index = ids.indexOf(id);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= ids.length) return;
    const next = [...ids];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange('order', next.join(','));
  };
  const toggleRotation = (id: string) => {
    const next = { ...rotations, [id]: ((rotations[id] ?? 0) + 90) % 360 };
    setRotations(next);
    onChange('rotations', JSON.stringify(items.map((item) => next[item.id] ?? 0)));
  };
  return (
    <Card className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="font-semibold">Arrange pages</h2><p className="text-sm text-muted">Reorder files before merging.</p></div>
        <span className="text-sm text-muted">{items.length} files</span>
      </div>
      <div className="mt-4 space-y-3">
        {ids.map((id, index) => {
          const item = items.find((candidate) => candidate.id === id);
          if (!item) return null;
          return (
            <div key={id} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
              const dragged = event.dataTransfer.getData('text/plain');
              const from = ids.indexOf(dragged);
              const to = ids.indexOf(id);
              if (from < 0 || to < 0 || from === to) return;
              const next = [...ids];
              next.splice(to, 0, ...next.splice(from, 1));
              onChange('order', next.join(','));
            }} className="flex flex-wrap items-center gap-3 rounded-xl border border-subtle p-3">
              <PdfPreview file={item.file} compact />
              <span className="min-w-0 flex-1 truncate font-semibold">{item.file.name}</span>
              <Button className="border border-subtle px-3 text-sm" aria-label={`Move ${item.file.name} up`} onClick={() => move(id, -1)} disabled={index === 0}>↑</Button>
              <Button className="border border-subtle px-3 text-sm" aria-label={`Move ${item.file.name} down`} onClick={() => move(id, 1)} disabled={index === ids.length - 1}>↓</Button>
              <Button className="border border-subtle text-sm" onClick={() => toggleRotation(id)}>Rotate {rotations[id] ?? 0}°</Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export { Settings };
export const buildRequest = (settings: Parameters<ToolModule['buildRequest']>[0], items: Parameters<ToolModule['buildRequest']>[1]): ToolRequest => {
    const orderIds = String(settings.order ?? items.map((item) => item.id).join(',')).split(',');
    const order = orderIds.map((id) => items.findIndex((item) => item.id === id)).filter((index) => index >= 0);
    const rotations = settings.rotations ? JSON.parse(String(settings.rotations)) as number[] : items.map(() => 0);
    return { operation: 'merge', options: { order: JSON.stringify(order), rotations: JSON.stringify(rotations) } };
};
const module: ToolModule = { Settings, buildRequest };

export default module;

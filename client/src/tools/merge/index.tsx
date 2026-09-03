import { useMemo, useState } from 'react';
import type { ToolModule, ToolRequest } from '../types';
import type { ToolSettingsProps } from '../types';
import { PdfPreview } from '../../components/PdfPreview';
import { Button, Card } from '../../components/ui/Primitives';
import { SortableList } from '../../components/SortableList';

function Settings({ items, settings, onChange }: ToolSettingsProps) {
  const ids = useMemo(() => {
    const saved = String(settings.order ?? '');
    const known = new Set(items.map((item) => item.id));
    const fromSettings = saved ? saved.split(',').filter((id) => known.has(id)) : [];
    return [...fromSettings, ...items.map((item) => item.id).filter((id) => !fromSettings.includes(id))];
  }, [items, settings.order]);
  const [rotations, setRotations] = useState<Record<string, number>>({});
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
      <div className="mt-4">
        <SortableList
          items={ids.map((id) => ({ id }))}
          onReorder={(from, to) => {
            if (to < 0 || to >= ids.length) return;
            const next = [...ids];
            [next[from], next[to]] = [next[to], next[from]];
            onChange('order', next.join(','));
          }}
          renderItem={({ id }) => {
            const item = items.find((candidate) => candidate.id === id);
            if (!item) return null;
            return (
              <div className="flex flex-wrap items-center gap-3 p-3">
                <PdfPreview file={item.file} compact />
                <span className="min-w-0 flex-1 truncate font-semibold">{item.file.name}</span>
                <Button className="border border-subtle text-sm" onClick={() => toggleRotation(id)}>Rotate {rotations[id] ?? 0}°</Button>
              </div>
            );
          }}
        />
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

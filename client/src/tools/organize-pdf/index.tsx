import { useEffect, useMemo, useState } from 'react';
import type { ToolModule, ToolRequest, ToolSettingsProps } from '../types';
import { PdfPreview } from '../../components/PdfPreview';
import { Button, Card } from '../../components/ui/Primitives';

type LocalOp = { source: number; rotate: 0 | 90 | 180 | 270 };

function Settings({ items, settings, onChange }: ToolSettingsProps) {
  const file = items[0]?.file;
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [history, setHistory] = useState<LocalOp[][]>([]);
  const ops = useMemo(() => {
    try {
      return JSON.parse(String(settings.ops ?? '[]')) as LocalOp[];
    } catch {
      return [];
    }
  }, [settings.ops]);
  useEffect(() => {
    if (count && !ops.length) {
      const initial = Array.from({ length: count }, (_value, index) => ({ source: index + 1, rotate: 0 as const }));
      onChange('ops', JSON.stringify(initial));
    }
  }, [count, ops.length]);
  const update = (next: LocalOp[]) => {
    setHistory((current) => [...current.slice(-9), ops]);
    onChange('ops', JSON.stringify(next));
  };
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ops.length) return;
    const next = [...ops];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };
  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold">Organize pages</h2><p className="text-sm text-secondary">Reorder, duplicate, rotate, or remove pages before saving.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button className="border border-subtle text-sm" onClick={() => history.length && onChange('ops', JSON.stringify(history[history.length - 1]))} disabled={!history.length}>Undo</Button>
          <Button className="border border-subtle text-sm" onClick={() => onChange('ops', JSON.stringify(Array.from({ length: count }, (_value, index) => ({ source: index + 1, rotate: 0 }))))} disabled={!count}>Reset to original</Button>
          <Button className="border border-subtle text-sm" onClick={() => {
            const selectedOps = ops.filter((op) => selected.includes(op.source));
            if (selectedOps.length) update(selectedOps);
          }} disabled={!selected.length}>Extract selected</Button>
        </div>
      </div>
      <PdfPreview file={file} selectable selected={selected} onSelectionChange={setSelected} onPageCount={setCount} />
      <div className="mt-4 space-y-2">
        {ops.map((op, index) => (
          <div
            key={`${op.source}-${index}`}
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const from = Number(event.dataTransfer.getData('text/plain'));
              if (!Number.isInteger(from) || from === index) return;
              const next = [...ops];
              const [entry] = next.splice(from, 1);
              next.splice(index, 0, entry);
              update(next);
            }}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-subtle p-2"
          >
            <span className="min-w-20 font-semibold">Page {op.source}</span>
            <span className="text-sm text-muted">Rotation {op.rotate}°</span>
            <span className="flex-1" />
            <Button className="border border-subtle text-sm" aria-label={`Move page ${op.source} left`} onClick={() => move(index, -1)} disabled={index === 0}>←</Button>
            <Button className="border border-subtle text-sm" aria-label={`Move page ${op.source} right`} onClick={() => move(index, 1)} disabled={index === ops.length - 1}>→</Button>
            <Button className="border border-subtle text-sm" onClick={() => update(ops.map((entry, entryIndex) => entryIndex === index ? { ...entry, rotate: ((entry.rotate + 90) % 360) as LocalOp['rotate'] } : entry))}>Rotate</Button>
            <Button className="border border-subtle text-sm" onClick={() => update([...ops.slice(0, index + 1), op, ...ops.slice(index + 1)])}>Duplicate</Button>
            <Button className="border border-subtle text-sm" onClick={() => update(ops.filter((_entry, entryIndex) => entryIndex !== index))} disabled={ops.length <= 1}>Delete</Button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">The page list above is the exact operation order sent to the server.</p>
      <div className="hidden">
        <button type="button" onClick={() => setSelected([])}>Clear</button>
      </div>
      {file && selected.length === 0 && <p className="mt-2 text-sm text-muted">Use the page preview for a visual reference, then manage pages below.</p>}
    </Card>
  );
}

export { Settings };
export const buildRequest = (settings: Parameters<ToolModule['buildRequest']>[0]): ToolRequest => ({
  operation: 'organize',
  options: { ops: String(settings.ops ?? '[]') },
});
const module: ToolModule = { Settings, buildRequest };
export default module;

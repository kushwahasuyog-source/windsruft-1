import { useState } from 'react';
import type { ToolModule, ToolRequest } from '../types';
import type { ToolSettingsProps } from '../types';
import { PdfPreview } from '../../components/PdfPreview';
import { Card } from '../../components/ui/Primitives';

function Settings({ items, settings, onChange }: ToolSettingsProps) {
  const file = items[0]?.file;
  const selected = settings.selected ? JSON.parse(String(settings.selected)) as number[] : [];
  const [allPages, setAllPages] = useState(true);
  const angle = Number(settings.angle ?? 90);
  return (
    <Card className="mt-6">
      <div className="grid gap-5 md:grid-cols-2">
        <fieldset>
          <legend className="font-semibold">Pages to rotate</legend>
          <label className="mt-3 flex items-center gap-2"><input type="radio" checked={allPages} onChange={() => setAllPages(true)} /> All pages</label>
          <label className="mt-3 flex items-center gap-2"><input type="radio" checked={!allPages} onChange={() => setAllPages(false)} /> Select pages in the preview</label>
        </fieldset>
        <fieldset>
          <legend className="font-semibold">Angle</legend>
          <div className="mt-3 flex gap-2">
            {[90, 180, 270].map((value) => <label key={value} className={`rounded-lg border px-3 py-2 ${angle === value ? 'border-accent bg-accent-soft' : 'border-subtle'}`}><input className="sr-only" type="radio" name="rotate-angle" checked={angle === value} onChange={() => onChange('angle', value)} />{value}°</label>)}
          </div>
        </fieldset>
      </div>
      {file && <PdfPreview file={file} selectable={!allPages} selected={selected} rotation={angle} onSelectionChange={(next) => onChange('selected', JSON.stringify(next))} />}
    </Card>
  );
}

export { Settings };
export const buildRequest = (settings: Parameters<ToolModule['buildRequest']>[0]): ToolRequest => ({
    operation: 'rotate',
    options: {
      pages: settings.selected && JSON.parse(String(settings.selected)).length
        ? (JSON.parse(String(settings.selected)) as number[]).join(',')
        : 'all',
      angle: Number(settings.angle ?? 90),
    },
});
const module: ToolModule = { Settings, buildRequest };

export default module;

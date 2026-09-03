import { useState } from 'react';
import type { ToolModule, ToolSettingsProps } from '../types';
import { SelectionPanel } from '../pageHelpers';
import { Card } from '../../components/ui/Primitives';
function Settings({ items, settings, onChange }: ToolSettingsProps) {
  const [count, setCount] = useState(0);
  return <><Card className="mt-6 grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold">Format<select className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" value={String(settings.format ?? 'jpg')} onChange={(e) => onChange('format', e.target.value)}><option>jpg</option><option>png</option><option>webp</option></select></label><label className="text-sm font-semibold">Quality<input className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" type="number" min="1" max="100" value={Number(settings.quality ?? 85)} onChange={(e) => onChange('quality', Number(e.target.value))} /></label><label className="text-sm font-semibold">DPI<input className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" type="number" min="36" max="600" value={Number(settings.dpi ?? 150)} onChange={(e) => onChange('dpi', Number(e.target.value))} /></label></Card>{items[0] && <SelectionPanel items={items} settings={settings} onChange={onChange} label="Pages to export" onPageCount={setCount}><p className="text-sm text-muted">Rendering at {Number(settings.dpi ?? 150)} DPI produces approximately {count ? `${Math.round((612 / 72) * Number(settings.dpi ?? 150))} × ${Math.round((792 / 72) * Number(settings.dpi ?? 150))}` : '…'} pixels for a Letter page.</p></SelectionPanel>}</>;
}
const module: ToolModule = { Settings, buildRequest: (settings) => ({ operation: 'pdf-to-jpg', options: { ...settings, pages: settings.pages ? JSON.parse(String(settings.pages)).join(',') : 'all' } }) };
export default module;

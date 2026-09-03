import { useState } from 'react';
import type { ToolModule, ToolSettingsProps } from '../types';
import { Card } from '../../components/ui/Primitives';
function Settings({ settings, onChange }: ToolSettingsProps) {
  const mode = String(settings.mode ?? 'html');
  const [urlError, setUrlError] = useState('');
  return (
    <Card className="mt-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`rounded-lg border px-3 py-2 text-sm ${mode === 'file' ? 'border-accent bg-accent-soft' : 'border-subtle'}`} onClick={() => onChange('mode', 'file')}>HTML file</button>
        <button type="button" className={`rounded-lg border px-3 py-2 text-sm ${mode === 'html' ? 'border-accent bg-accent-soft' : 'border-subtle'}`} onClick={() => onChange('mode', 'html')}>Pasted HTML</button>
        <button type="button" className={`rounded-lg border px-3 py-2 text-sm ${mode === 'url' ? 'border-accent bg-accent-soft' : 'border-subtle'}`} onClick={() => onChange('mode', 'url')}>Public URL</button>
      </div>
      {mode === 'file' ? (
        <p className="mt-4 text-sm text-secondary">Upload an .html file above; PDFForge renders it inside an isolated temporary workspace and never loads local file paths.</p>
      ) : mode === 'html' ? (
        <label className="mt-4 block text-sm font-semibold">HTML content
          <textarea className="mt-2 min-h-48 w-full rounded-lg border border-subtle bg-surface p-3 font-mono text-sm font-normal" value={String(settings.html ?? '<h1>Hello PDFForge</h1>')} onChange={(event) => onChange('html', event.target.value)} />
        </label>
      ) : (
        <label className="mt-4 block text-sm font-semibold">Public URL
          <input className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal" type="url" value={String(settings.url ?? '')} onChange={(event) => {
            onChange('url', event.target.value);
            setUrlError(event.target.value && !/^https?:\/\//.test(event.target.value) ? 'Use an http or https URL.' : '');
          }} />
          {urlError && <span className="mt-1 block text-sm text-danger">{urlError}</span>}
          <span className="mt-1 block text-xs text-muted">Private, local, file, and data URLs are rejected by the server.</span>
        </label>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold">Page size
          <select className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" value={String(settings.pageSize ?? 'A4')} onChange={(event) => onChange('pageSize', event.target.value)}><option>A4</option><option>Letter</option></select>
        </label>
        <label className="text-sm font-semibold">Orientation
          <select className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" value={String(settings.orientation ?? 'portrait')} onChange={(event) => onChange('orientation', event.target.value)}><option>portrait</option><option>landscape</option></select>
        </label>
        <label className="text-sm font-semibold">Margin (pt)
          <input className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" type="number" min="0" max="144" value={Number(settings.margin ?? 24)} onChange={(event) => onChange('margin', Number(event.target.value))} />
        </label>
      </div>
    </Card>
  );
}
const module: ToolModule = { Settings, buildRequest: (settings) => ({ operation: 'html-to-pdf', options: settings }) };
export default module;

import { useState } from 'react';
import { PdfPreview } from '../../components/PdfPreview';
import { Button, Card } from '../../components/ui/Primitives';
import type { ToolModule, ToolRequest, ToolSettingsProps } from '../types';

const positions = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const;
const formats = ['1', 'Page 1', '1 / 10', 'Page 1 of 10'] as const;

function Settings({ items, settings, onChange }: ToolSettingsProps) {
  const file = items[0]?.file;
  const [count, setCount] = useState(0);
  const selected = settings.pages ? JSON.parse(String(settings.pages)) as number[] : [];
  const allPages = settings.allPages !== false && settings.allPages !== 'false';
  const format = String(settings.format ?? 'Page 1 of 10');
  const example = format.replace('1', String(settings.startNumber ?? 1)).replace('10', String(count || 10));
  return (
    <Card className="mt-6">
      <h2 className="font-semibold">Page number settings</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">Format<select className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal" value={format} onChange={(event) => onChange('format', event.target.value)}>{formats.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-sm font-semibold">Font family<select className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal" value={String(settings.fontFamily ?? 'Helvetica')} onChange={(event) => onChange('fontFamily', event.target.value)}><option>Helvetica</option><option>Times</option><option>Courier</option></select></label>
        <label className="text-sm font-semibold">Font size<input className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal" type="number" min="6" max="120" value={Number(settings.fontSize ?? 12)} onChange={(event) => onChange('fontSize', Number(event.target.value))} /></label>
        <label className="text-sm font-semibold">Start number<input className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal" type="number" min="0" value={Number(settings.startNumber ?? 1)} onChange={(event) => onChange('startNumber', Number(event.target.value))} /></label>
        <label className="text-sm font-semibold">Color<input className="mt-2 h-10 w-full rounded-lg border border-subtle bg-surface p-1" type="color" value={String(settings.color ?? '#111827')} onChange={(event) => onChange('color', event.target.value)} /></label>
      </div>
      <fieldset className="mt-5">
        <legend className="text-sm font-semibold">Position</legend>
        <div className="mt-2 grid max-w-md grid-cols-3 gap-2">{positions.map((position) => <button type="button" key={position} onClick={() => onChange('position', position)} className={`rounded-lg border p-3 text-sm capitalize ${String(settings.position ?? 'bottom-center') === position ? 'border-accent bg-accent-soft' : 'border-subtle'}`}>{position.replace('-', ' ')}</button>)}</div>
      </fieldset>
      <p className="mt-3 text-sm text-muted">Page numbers follow each page&apos;s position in the document, even when you apply them to a subset; totals always use the full document page count.</p>
      <label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={allPages} onChange={(event) => onChange('allPages', event.target.checked)} />Apply to all pages ({count || '…'})</label>
      {file && (
        <PdfPreview
          file={file}
          selectable={!allPages}
          selected={selected}
          onSelectionChange={(pages) => onChange('pages', JSON.stringify(pages))}
          onPageCount={setCount}
          overlay={({ scale, width, height, page }) => {
            const size = Number(settings.fontSize ?? 12);
            const margin = Math.max(12, size);
            const position = String(settings.position ?? 'bottom-center');
            const label = format
              .replace('1', String(Number(settings.startNumber ?? 1) + page - 1))
              .replace('10', String(count || 10));
            return (
              <span
                className="absolute whitespace-nowrap"
                style={{
                  color: String(settings.color ?? '#111827'),
                  fontFamily: String(settings.fontFamily ?? 'Helvetica'),
                  fontSize: size * scale,
                  lineHeight: 1,
                  ...(position.endsWith('left')
                    ? { left: margin * scale }
                    : position.endsWith('right')
                      ? { right: margin * scale }
                      : { left: width * scale / 2, transform: 'translateX(-50%)' }),
                  ...(position.startsWith('top')
                    ? { top: margin * scale }
                    : { top: (height - margin - size) * scale }),
                }}
              >
                {label}
              </span>
            );
          }}
        />
      )}
      <p className="mt-3 text-sm text-muted">Live example on page 1: <span className="font-semibold text-primary">{example}</span></p>
      {!allPages && !selected.length && <p className="mt-2 text-sm text-danger">Select at least one page.</p>}
      <Button className="mt-3 border border-subtle text-sm" onClick={() => onChange('pages', JSON.stringify(Array.from({ length: count }, (_value, index) => index + 1)))} disabled={!count}>Select all pages</Button>
    </Card>
  );
}

export { Settings };
export const buildRequest = (settings: Parameters<ToolModule['buildRequest']>[0]): ToolRequest => ({
  operation: 'page-numbers',
  options: {
    position: String(settings.position ?? 'bottom-center'),
    format: String(settings.format ?? 'Page 1 of 10'),
    fontFamily: String(settings.fontFamily ?? 'Helvetica'),
    fontSize: Number(settings.fontSize ?? 12),
    color: String(settings.color ?? '#111827'),
    startNumber: Number(settings.startNumber ?? 1),
    pages: settings.allPages === false || settings.allPages === 'false' ? String(settings.pages ?? '[]') : 'all',
  },
});
const module: ToolModule = { Settings, buildRequest };
export default module;

import { useEffect, useState } from 'react';
import type { ToolModule, ToolRequest } from '../types';
import type { ToolSettingsProps } from '../types';
import { PdfPreview } from '../../components/PdfPreview';
import { apiClient } from '../../services/apiClient';
import { Card } from '../../components/ui/Primitives';

function parseRanges(value: string, pages: number): string | undefined {
  if (!value.trim()) return 'Enter one or more ranges.';
  const valid = value.split(',').every((token) => {
    const parts = token.trim().split('-').map(Number);
    if (parts.some((part) => !Number.isInteger(part)) || parts.length > 2) return false;
    const [start, end = start] = parts;
    return start >= 1 && end >= start && end <= pages;
  });
  return valid ? undefined : `Use ranges between 1 and ${pages}, such as 1-5,6-10.`;
}

function Settings({ items, settings, onChange }: ToolSettingsProps) {
  const file = items[0]?.file;
  const [pages, setPages] = useState(0);
  const [rangeError, setRangeError] = useState<string>();
  const mode = String(settings.mode ?? 'every-page');
  const ranges = String(settings.ranges ?? '');
  const selected = settings.selected ? JSON.parse(String(settings.selected)) as number[] : [];
  useEffect(() => {
    if (!file) return;
    void apiClient.pageInfo(file).then((info) => setPages(info.pages)).catch(() => setPages(0));
  }, [file]);
  useEffect(() => {
    if (mode === 'ranges' && pages) setRangeError(parseRanges(ranges, pages));
    else setRangeError(undefined);
  }, [mode, pages, ranges]);
  useEffect(() => {
    onChange('rangeError', rangeError ?? '');
  }, [onChange, rangeError]);
  return (
    <Card className="mt-6">
      <fieldset>
        <legend className="font-semibold">Split mode</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ['every-page', 'Every page', 'One PDF for each page.'],
            ['ranges', 'Custom ranges', 'Use 1-5,6-10,11-15.'],
            ['extract', 'Extract pages', 'Choose pages below.'],
          ].map(([value, title, note]) => (
            <label key={value} className={`cursor-pointer rounded-xl border p-4 ${mode === value ? 'border-accent bg-accent-soft' : 'border-subtle'}`}>
              <input className="sr-only" type="radio" name="split-mode" value={value} checked={mode === value} onChange={() => onChange('mode', value)} />
              <span className="block font-bold">{title}</span><span className="mt-1 block text-sm text-secondary">{note}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {mode === 'ranges' && (
        <label className="mt-5 block text-sm font-semibold" htmlFor="split-ranges">
          Page ranges
          <input id="split-ranges" className={`mt-2 w-full rounded-lg border bg-surface px-3 py-2 font-normal ${rangeError ? 'border-danger' : 'border-subtle'}`} value={ranges} placeholder="1-5,6-10,11-15" onChange={(event) => onChange('ranges', event.target.value)} />
          <span className={`mt-1 block font-normal ${rangeError ? 'text-danger' : 'text-muted'}`}>{rangeError ?? (pages ? `Document has ${pages} pages.` : 'Loading page count…')}</span>
        </label>
      )}
      {mode === 'extract' && file && (
        <PdfPreview file={file} selectable selected={selected} onSelectionChange={(next) => onChange('selected', JSON.stringify(next))} />
      )}
    </Card>
  );
}

export { Settings };
export const buildRequest = (settings: Parameters<ToolModule['buildRequest']>[0]): ToolRequest => ({
    operation: 'split',
    options: {
      mode: String(settings.mode ?? 'every-page'),
      ranges: String(settings.mode ?? 'every-page') === 'extract'
        ? (JSON.parse(String(settings.selected ?? '[]')) as number[]).join(',')
        : String(settings.ranges ?? ''),
    },
});
const module: ToolModule = { Settings, buildRequest };

export default module;

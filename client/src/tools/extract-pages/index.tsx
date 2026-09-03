import { useEffect, useState } from 'react';
import type { ToolModule, ToolRequest, ToolSettingsProps } from '../types';
import { pageListText, parsePageList, SelectionPanel } from '../pageHelpers';

function Settings({ items, settings, onChange }: ToolSettingsProps) {
  const [count, setCount] = useState(0);
  const pages = settings.pages ? JSON.parse(String(settings.pages)) as number[] : [];
  const ranges = String(settings.ranges ?? '');
  const parsed = parsePageList(ranges, count);
  const error = ranges.trim() && (!parsed.length || parsed.some((page) => page > count))
    ? `Use pages between 1 and ${count}.`
    : undefined;
  useEffect(() => {
    if (ranges && parsed.length && pageListText(pages) !== pageListText(parsed)) onChange('pages', JSON.stringify(parsed));
  }, [ranges, parsed.join(','), pages.join(',')]);
  return (
    <SelectionPanel
      items={items}
      settings={settings}
      onChange={(key, value) => {
        if (key === 'pages') {
          const next = JSON.parse(String(value)) as number[];
          onChange(key, value);
          onChange('ranges', pageListText(next));
        } else onChange(key, value);
      }}
      label="Pages to extract"
      onPageCount={setCount}
    >
      <label className="mt-4 block text-sm font-semibold" htmlFor="extract-ranges">
        Page ranges
        <input
          id="extract-ranges"
          value={ranges}
          onChange={(event) => {
            const value = event.target.value;
            onChange('ranges', value);
            const next = parsePageList(value, count);
            if (next.length) onChange('pages', JSON.stringify(next));
          }}
          placeholder="1-3,7"
          className={`mt-2 w-full rounded-lg border bg-surface px-3 py-2 font-normal ${error ? 'border-danger' : 'border-subtle'}`}
          aria-invalid={Boolean(error)}
        />
        <span className={`mt-1 block font-normal ${error ? 'text-danger' : 'text-muted'}`}>{error ?? (count ? `Document has ${count} pages.` : 'Loading page count…')}</span>
      </label>
    </SelectionPanel>
  );
}

export { Settings };
export const buildRequest = (settings: Parameters<ToolModule['buildRequest']>[0]): ToolRequest => ({
  operation: 'extract-pages',
  options: {
    pages: String(settings.pages ?? '[]'),
    ranges: String(settings.ranges ?? ''),
  },
});
const module: ToolModule = { Settings, buildRequest };
export default module;

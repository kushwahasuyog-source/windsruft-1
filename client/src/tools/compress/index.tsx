import type { ToolModule } from '../types';
import type { ToolSettingsProps } from '../types';
import { PdfPreview } from '../../components/PdfPreview';
import { Card } from '../../components/ui/Primitives';

const levels = [
  { value: 'low', title: 'Low', note: 'Preserves the most visual detail.' },
  { value: 'recommended', title: 'Recommended', note: 'A balanced choice for sharing.' },
  { value: 'high', title: 'High', note: 'Makes the smallest practical file.' },
] as const;

function Settings({ items, settings, onChange }: ToolSettingsProps) {
  const level = String(settings.level ?? 'recommended');
  const completed = items.find((item) => item.result?.files[0]);
  const result = completed?.result?.files[0];
  return (
    <>
      <Card className="mt-6">
        <fieldset>
          <legend className="font-semibold">Compression level</legend>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {levels.map((option) => (
              <label key={option.value} className={`cursor-pointer rounded-xl border p-4 ${level === option.value ? 'border-accent bg-accent-soft' : 'border-subtle'}`}>
                <input className="sr-only" type="radio" name="compression-level" value={option.value} checked={level === option.value} onChange={() => onChange('level', option.value)} />
                <span className="block font-bold">{option.title}</span>
                <span className="mt-1 block text-sm text-secondary">{option.note}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>
      {completed && result && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div>
            <h2 className="mb-2 font-semibold">Before</h2>
            <PdfPreview file={completed.file} />
          </div>
          <div>
            <h2 className="mb-2 font-semibold">After</h2>
            <PdfPreview source={result.downloadUrl} />
          </div>
        </div>
      )}
    </>
  );
}

export { Settings };
export const buildRequest = (settings: Parameters<ToolModule['buildRequest']>[0]) => ({ operation: 'compress' as const, options: { level: settings.level ?? 'recommended' } });
const module: ToolModule = { Settings, buildRequest };

export default module;

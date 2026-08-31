import type { ToolModule, ToolSettingsProps } from '../types';
import { Card } from '../../components/ui/Primitives';

const languages: Array<[string, string]> = [
  ['eng', 'English'],
  ['spa', 'Spanish'],
  ['fra', 'French'],
  ['deu', 'German'],
  ['ita', 'Italian'],
  ['por', 'Portuguese'],
  ['hin', 'Hindi'],
  ['ara', 'Arabic'],
  ['chi_sim', 'Chinese (Simplified)'],
  ['jpn', 'Japanese'],
];

const latin = new Set(['eng', 'spa', 'fra', 'deu', 'ita', 'por']);

function Settings({ settings, onChange }: ToolSettingsProps) {
  const language = String(settings.language ?? 'eng');
  return (
    <Card className="mt-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Document language
          <select
            className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal"
            value={language}
            onChange={(event) => onChange('language', event.target.value)}
          >
            {languages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Render quality (DPI)
          <input
            className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal"
            type="number"
            min="200"
            max="300"
            step="10"
            value={Number(settings.dpi ?? 250)}
            onChange={(event) => onChange('dpi', Number(event.target.value))}
          />
        </label>
      </div>
      <p className="mt-4 text-sm text-muted">
        Recognition runs on the server and can take a minute or more per page. You always receive the extracted text file.
      </p>
      {!latin.has(language) && (
        <p className="mt-2 text-sm text-secondary">
          For this script a searchable text layer needs a Unicode font configured on the server (OCR_UNICODE_FONT_PATH). Without it PDFForge returns the extracted text as a .txt download instead of pretending the PDF is searchable.
        </p>
      )}
    </Card>
  );
}

const module: ToolModule = {
  Settings,
  buildRequest: (settings) => ({
    operation: 'ocr',
    options: { language: String(settings.language ?? 'eng'), dpi: Number(settings.dpi ?? 250) },
  }),
};
export default module;

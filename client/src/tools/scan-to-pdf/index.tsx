import type { ToolModule, ToolSettingsProps } from '../types';
import { ImageOrderSettings, PdfOutputSettings } from '../conversionHelpers';

function Settings({ settings, onChange, ...rest }: ToolSettingsProps) {
  return <><ImageOrderSettings settings={settings} onChange={onChange} {...rest} title="Scan order" /><PdfOutputSettings settings={settings} onChange={onChange} image /><label className="mt-4 flex items-center justify-center gap-2 text-sm"><input type="checkbox" checked={settings.enhance !== false} onChange={(event) => onChange('enhance', event.target.checked)} />Enhance scans with grayscale, contrast, and sharpening</label></>;
}
const module: ToolModule = { Settings, buildRequest: (settings) => ({ operation: 'scan-to-pdf', options: { ...settings } }) };
export default module;

import { useState } from 'react';
import { Card } from '../../components/ui/Primitives';
import type { ToolModule, ToolRequest, ToolSettingsProps } from '../types';

function Settings({ settings, onChange }: ToolSettingsProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Card className="mt-6">
      <h2 className="font-semibold">Unlock PDF</h2>
      <p className="mt-1 text-sm text-secondary">Enter the password for a file you are authorized to open. PDFForge does not guess or bypass passwords.</p>
      <label className="mt-4 block text-sm font-semibold">PDF password<div className="mt-2 flex max-w-lg"><input className="min-w-0 flex-1 rounded-l-lg border border-subtle bg-surface p-2 font-normal" type={visible ? 'text' : 'password'} value={String(settings.password ?? '')} onChange={(event) => onChange('password', event.target.value)} autoComplete="off" /><button type="button" className="rounded-r-lg border border-l-0 border-subtle px-3 text-sm" onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button></div></label>
      <p className="mt-3 text-sm text-muted">The password is used only for this request and is never saved in history.</p>
    </Card>
  );
}

export { Settings };
export const buildRequest = (settings: Parameters<ToolModule['buildRequest']>[0]): ToolRequest => ({ operation: 'unlock', options: { password: String(settings.password ?? '') } });
const module: ToolModule = { Settings, buildRequest };
export default module;

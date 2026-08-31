import { useState } from 'react';
import { Card } from '../../components/ui/Primitives';
import type { ToolModule, ToolRequest, ToolSettingsProps } from '../types';

function SecretField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <label className="block text-sm font-semibold">{label}{required ? ' (required)' : ' (optional)'}<div className="mt-2 flex"><input className="min-w-0 flex-1 rounded-l-lg border border-subtle bg-surface p-2 font-normal" type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" /><button type="button" className="rounded-r-lg border border-l-0 border-subtle px-3 text-sm" onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button></div></label>;
}

function Settings({ settings, onChange }: ToolSettingsProps) {
  const owner = String(settings.ownerPassword ?? '');
  const user = String(settings.userPassword ?? '');
  const confirm = String(settings.confirmPassword ?? '');
  const mismatch = confirm.length > 0 && owner !== confirm;
  return (
    <Card className="mt-6">
      <h2 className="font-semibold">Protect PDF</h2>
      <p className="mt-1 text-sm text-secondary">The owner password is required to control permissions. An optional open password is needed to view the file.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SecretField label="Permissions password" value={owner} required onChange={(value) => onChange('ownerPassword', value)} />
        <SecretField label="Open password" value={user} onChange={(value) => onChange('userPassword', value)} />
        <SecretField label="Confirm permissions password" value={confirm} required onChange={(value) => onChange('confirmPassword', value)} />
      </div>
      <p className="mt-2 text-sm text-muted">{owner.length >= 12 ? 'Strong password.' : 'Use 12 or more characters for a stronger password.'}</p>
      {mismatch && <p className="mt-2 text-sm text-danger">Passwords do not match.</p>}
      <fieldset className="mt-5 space-y-2"><legend className="text-sm font-semibold">Permissions</legend>{[['allowPrinting', 'Allow printing'], ['allowEditing', 'Allow editing'], ['allowCopying', 'Allow copying']].map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings[key] === true} onChange={(event) => onChange(key, event.target.checked)} />{label}</label>)}</fieldset>
      {(!owner || mismatch) && <p className="mt-3 text-sm text-danger">Enter and confirm the required permissions password.</p>}
    </Card>
  );
}

export { Settings };
export const buildRequest = (settings: Parameters<ToolModule['buildRequest']>[0]): ToolRequest => ({
  operation: 'protect',
  options: { ownerPassword: String(settings.ownerPassword ?? ''), userPassword: String(settings.userPassword ?? ''), allowPrinting: settings.allowPrinting === true, allowEditing: settings.allowEditing === true, allowCopying: settings.allowCopying === true },
});
const module: ToolModule = { Settings, buildRequest };
export default module;

import type { ToolModule, ToolSettingsProps } from '../types';
import { Card } from '../../components/ui/Primitives';
function Settings(_props: ToolSettingsProps) { return <Card className="mt-6"><p className="text-sm text-secondary">Repair accepts files even when their preview cannot render. It writes a new PDF only after verifying that the repaired output opens and contains pages.</p></Card>; }
const module: ToolModule = { Settings, buildRequest: (settings) => ({ operation: 'repair', options: settings }) };
export default module;

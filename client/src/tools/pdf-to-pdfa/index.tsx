import type { ToolModule, ToolSettingsProps } from '../types';
import { Card } from '../../components/ui/Primitives';
function Settings(_props: ToolSettingsProps) { return <Card className="mt-6"><p className="text-sm text-secondary">The output target is PDF/A-2. Independent validation is reported only when a veraPDF executable is configured on the server.</p></Card>; }
const module: ToolModule = { Settings, buildRequest: (settings) => ({ operation: 'pdf-to-pdfa', options: settings }) };
export default module;

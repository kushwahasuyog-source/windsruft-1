import type { ToolModule, ToolSettingsProps } from '../types';
import { Card } from '../../components/ui/Primitives';
function Settings(_props: ToolSettingsProps) { return <Card className="mt-6"><p className="text-sm text-secondary">The original Word content is converted through LibreOffice when available. Text, common formatting, and page breaks are preserved.</p></Card>; }
const module: ToolModule = { Settings, buildRequest: (settings) => ({ operation: 'word-to-pdf', options: settings }) };
export default module;

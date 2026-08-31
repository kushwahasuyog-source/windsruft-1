import type { ToolModule, ToolSettingsProps } from '../types';
import { Card } from '../../components/ui/Primitives';
function Settings(_props: ToolSettingsProps) { return <Card className="mt-6"><p className="text-sm text-secondary">Each PDF page becomes a 16:9 slide image. Extracted page text is stored in slide notes; page elements are not independently editable.</p></Card>; }
const module: ToolModule = { Settings, buildRequest: (settings) => ({ operation: 'pdf-to-ppt', options: settings }) };
export default module;

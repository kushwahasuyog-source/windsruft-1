import type { ToolModule, ToolSettingsProps } from '../types';
import { Card } from '../../components/ui/Primitives';
function Settings(_props: ToolSettingsProps) { return <Card className="mt-6"><p className="text-sm text-secondary">PowerPoint slides are rendered by the installed office engine; speaker notes and editable slide objects are not preserved in the PDF.</p></Card>; }
const module: ToolModule = { Settings, buildRequest: (settings) => ({ operation: 'ppt-to-pdf', options: settings }) };
export default module;

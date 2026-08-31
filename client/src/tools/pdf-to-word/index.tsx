import type { ToolModule, ToolSettingsProps } from '../types';
import { Card } from '../../components/ui/Primitives';
function Settings(_props: ToolSettingsProps) { return <Card className="mt-6"><p className="text-sm text-secondary">Text and paragraph breaks are preserved one page at a time. Original layout, images, and editable positioning are not preserved.</p></Card>; }
const module: ToolModule = { Settings, buildRequest: (settings) => ({ operation: 'pdf-to-word', options: settings }) };
export default module;

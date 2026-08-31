import type { ToolModule, ToolSettingsProps } from '../types';
import { Card } from '../../components/ui/Primitives';
function Settings(_props: ToolSettingsProps) { return <Card className="mt-6"><p className="text-sm text-secondary">Only pages with recognizable row-and-column spacing are exported as sheets. If no table structure is detected, PDFForge reports that instead of creating a junk spreadsheet.</p></Card>; }
const module: ToolModule = { Settings, buildRequest: (settings) => ({ operation: 'pdf-to-excel', options: settings }) };
export default module;

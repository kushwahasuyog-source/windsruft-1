import type { ToolModule, ToolSettingsProps } from '../types';
import { Card } from '../../components/ui/Primitives';
function Settings(_props: ToolSettingsProps) { return <Card className="mt-6"><p className="text-sm text-secondary">Spreadsheet values and visible formatting are rendered by the installed office engine. Formulas remain visible as their calculated values.</p></Card>; }
const module: ToolModule = { Settings, buildRequest: (settings) => ({ operation: 'excel-to-pdf', options: settings }) };
export default module;

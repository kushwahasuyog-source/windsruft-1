import type { ToolModule, ToolSettingsProps } from '../types';
import { Card } from '../../components/ui/Primitives';
function Settings({ items }: ToolSettingsProps) { return <Card className="mt-6"><p className="text-sm text-secondary">{items.length < 2 ? 'Add two PDFs: document A and document B.' : 'The server compares positioned text and returns added, removed, and changed pages with word-level differences.'}</p></Card>; }
const module: ToolModule = { Settings, buildRequest: (settings) => ({ operation: 'compare', options: { ...settings } }) };
export default module;

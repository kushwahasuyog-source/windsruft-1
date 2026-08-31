import type { ToolModule } from '../types';
import { EditSettings } from '../phase5Helpers';
const module: ToolModule = { Settings: EditSettings, buildRequest: (settings) => ({ operation: 'edit', options: { ...settings, ops: settings.ops ?? '[]' } }) };
export default module;

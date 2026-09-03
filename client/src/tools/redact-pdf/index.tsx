import type { ToolModule } from '../types';
import { RedactSettings } from '../phase5Helpers';
const module: ToolModule = { Settings: RedactSettings, buildRequest: (settings) => ({ operation: 'redact', options: { ...settings, boxes: settings.boxes ?? '[]' } }) };
export default module;

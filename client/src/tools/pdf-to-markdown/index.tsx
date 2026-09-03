import type { ToolModule } from '../types';
import { MarkdownSettings } from '../phase5Helpers';
const module: ToolModule = { Settings: MarkdownSettings, buildRequest: (settings) => ({ operation: 'markdown', options: { ...settings } }) };
export default module;

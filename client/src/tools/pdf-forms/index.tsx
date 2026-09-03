import type { ToolModule } from '../types';
import { FormsSettings } from '../phase5Helpers';
const module: ToolModule = { Settings: FormsSettings, buildRequest: (settings) => ({ operation: 'forms', options: { ...settings } }) };
export default module;

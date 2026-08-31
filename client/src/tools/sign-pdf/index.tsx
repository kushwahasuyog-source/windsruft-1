import type { ToolModule } from '../types';
import { SignSettings } from '../phase5Helpers';
const module: ToolModule = { Settings: SignSettings, buildRequest: (settings) => ({ operation: 'sign', options: { ...settings } }) };
export default module;

import type { ToolModule } from '../types';
import { TranslateSettings } from '../phase5Helpers';

const module: ToolModule = {
  Settings: TranslateSettings,
  buildRequest: (settings) => ({ operation: 'translate', options: { ...settings } }),
};

export default module;

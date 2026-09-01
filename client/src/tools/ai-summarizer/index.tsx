import type { ToolModule } from '../types';
import { AiSummarizerSettings } from '../phase5Helpers';

const module: ToolModule = {
  Settings: AiSummarizerSettings,
  buildRequest: (settings) => ({ operation: 'summarize', options: { ...settings } }),
};

export default module;

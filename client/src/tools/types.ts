import type { ComponentType } from 'react';
import type { QueueItem } from '../hooks/useFileQueue';

export type ToolSetting = string | number | boolean | File;
export type ToolSettings = Record<string, ToolSetting>;

export interface ToolSettingsProps {
  items: QueueItem[];
  settings: ToolSettings;
  onChange: (key: string, value: ToolSetting) => void;
}

export interface ToolRequest {
  operation:
    | 'compress'
    | 'merge'
    | 'split'
    | 'rotate'
    | 'remove-pages'
    | 'extract-pages'
    | 'organize'
    | 'page-numbers'
    | 'watermark'
    | 'crop'
    | 'protect'
    | 'unlock';
  options: ToolSettings;
}

export interface ToolModule {
  Settings: ComponentType<ToolSettingsProps>;
  buildRequest: (settings: ToolSettings, items: QueueItem[]) => ToolRequest;
}

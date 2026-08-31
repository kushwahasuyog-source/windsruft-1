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
    | 'unlock'
    | 'repair'
    | 'ocr'
    | 'jpg-to-pdf'
    | 'scan-to-pdf'
    | 'word-to-pdf'
    | 'ppt-to-pdf'
    | 'excel-to-pdf'
    | 'html-to-pdf'
    | 'pdf-to-jpg'
    | 'pdf-to-word'
    | 'pdf-to-ppt'
    | 'pdf-to-excel'
    | 'pdf-to-pdfa';
  options: ToolSettings;
}

export interface ToolModule {
  Settings: ComponentType<ToolSettingsProps>;
  buildRequest: (settings: ToolSettings, items: QueueItem[]) => ToolRequest;
}

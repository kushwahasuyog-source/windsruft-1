import type { ToolModule, ToolSettingsProps } from '../types';
import { ImageOrderSettings, PdfOutputSettings } from '../conversionHelpers';

function Settings(props: ToolSettingsProps) {
  return <><ImageOrderSettings {...props} /><PdfOutputSettings {...props} image /></>;
}
const module: ToolModule = { Settings, buildRequest: (settings) => ({ operation: 'jpg-to-pdf', options: { ...settings } }) };
export default module;

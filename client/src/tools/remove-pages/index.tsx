import type { ToolModule, ToolRequest, ToolSettingsProps } from '../types';
import { SelectionPanel } from '../pageHelpers';

function Settings(props: ToolSettingsProps) {
  return (
    <SelectionPanel {...props} label="Pages to remove">
      <p className="mt-3 text-sm text-secondary">The resulting document will keep every page that is not selected.</p>
    </SelectionPanel>
  );
}

export { Settings };
export const buildRequest = (settings: Parameters<ToolModule['buildRequest']>[0]): ToolRequest => ({
  operation: 'remove-pages',
  options: { pages: String(settings.pages ?? '[]') },
});
const module: ToolModule = { Settings, buildRequest };
export default module;

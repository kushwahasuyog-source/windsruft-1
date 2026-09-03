import { useLocation, useParams } from 'react-router-dom';
import { getTool } from '@shared/tools';
import { ToolPageLayout } from '../components/ToolPageLayout';
import { NotFound } from './NotFound';

interface ToolNavigationState {
  file?: File;
}

function getNavigationFile(state: unknown): File | undefined {
  if (!state || typeof state !== 'object') return undefined;
  const candidate = (state as ToolNavigationState).file;
  return candidate instanceof File ? candidate : undefined;
}

export function ToolPage() {
  const { slug } = useParams();
  const location = useLocation();
  const tool = getTool(slug ?? '');
  if (!tool) return <NotFound />;
  return <ToolPageLayout tool={tool} initialFile={getNavigationFile(location.state)} />;
}

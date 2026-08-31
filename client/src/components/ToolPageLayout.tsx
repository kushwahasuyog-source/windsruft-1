import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ToolDefinition } from '@shared/tools';
import { FileDropzone } from './FileDropzone';
import { FileList } from './FileList';
import { useFileQueue, type QueueOptions } from '../hooks/useFileQueue';
import { loadToolModule } from '../tools/loader';
import type { ToolModule, ToolSetting, ToolSettings } from '../tools/types';
import { addHistory } from '../services/history';
import { Button, Card, Spinner } from './ui/Primitives';

export function ToolPageLayout({
  tool,
  children,
  initialFile,
}: {
  tool: ToolDefinition;
  children?: ReactNode;
  initialFile?: File;
}) {
  const queue = useFileQueue();
  const [module, setModule] = useState<ToolModule>();
  const [settings, setSettings] = useState<ToolSettings>({ level: localStorage.getItem('pdfforge-default-level') ?? 'recommended' });
  const [hasAddedInitialFile, setHasAddedInitialFile] = useState(false);
  const recorded = useRef(new Set<string>());
  useEffect(() => {
    let active = true;
    setModule(undefined);
    setSettings({ level: localStorage.getItem('pdfforge-default-level') ?? 'recommended' });
    void loadToolModule(tool.slug).then((loaded) => {
      if (active) setModule(loaded);
    });
    return () => { active = false; };
  }, [tool.slug]);
  useEffect(() => {
    if (initialFile && !hasAddedInitialFile) {
      queue.add([initialFile]);
      setHasAddedInitialFile(true);
    }
  }, [initialFile, hasAddedInitialFile, queue.add]);
  useEffect(() => {
    queue.items.filter((item) => (item.status === 'COMPLETED' || item.status === 'FAILED') && !recorded.current.has(item.id)).forEach((item) => {
      recorded.current.add(item.id);
      const result = item.result?.files[0];
      addHistory({
        fileName: item.file.name,
        tool: tool.name,
        status: item.status === 'COMPLETED' ? 'completed' : 'failed',
        ...(result ? { downloadUrl: result.downloadUrl } : {}),
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      });
    });
  }, [queue.items, tool.name]);
  const updateSetting = useCallback((key: string, value: ToolSetting) => setSettings((current) => {
    if (current[key] === value) return current;
    return { ...current, [key]: value };
  }), []);
  const request = module ? module.buildRequest(settings, queue.items) : undefined;
  const SettingsComponent = module?.Settings;
  const run = () => {
    if (request) void queue.process(request.operation, request.options as QueueOptions);
  };
  const retry = (id: string) => {
    if (request) void queue.retry(id, request.operation, request.options as QueueOptions);
  };
  const invalid = Boolean(settings.rangeError) || (tool.slug === 'merge-pdf' && queue.items.length < 2);
  return (
    <main className="mx-auto max-w-shell px-gutter py-section">
      <header className="mb-10 text-center">
        <p className="mb-3 text-sm font-bold uppercase tracking-widest text-accent">{tool.category}</p>
        <h1 className="font-display text-4xl font-black sm:text-5xl">{tool.name}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-secondary">{tool.description}</p>
        <p className="mt-3 text-sm text-muted">Accepts {tool.accepts.join(', ')} · Up to 50 MB per file</p>
      </header>
      {tool.status === 'planned' ? (
        <Card className="mx-auto max-w-2xl border-accent/30 text-center">
          <p className="text-lg font-bold">This tool is coming in this build.</p>
          <p className="mt-2 text-secondary">The full workspace shell is ready; processing will arrive in a later phase.</p>
        </Card>
      ) : (
        <>
          <FileDropzone accepts={tool.accepts} multiple={tool.multiple} onFiles={queue.add} />
          {SettingsComponent ? <SettingsComponent items={queue.items} settings={settings} onChange={updateSetting} /> : <Card className="mt-6 flex justify-center"><Spinner /></Card>}
          {children}
          <FileList items={queue.items} onRemove={queue.remove} onRetry={retry} />
          {queue.items.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button className="bg-accent text-on-accent" disabled={queue.processing || invalid} onClick={run}>{queue.processing ? 'Processing…' : `Start ${tool.name}`}</Button>
              {queue.processing && <Button className="border border-subtle" onClick={queue.cancel}>Cancel</Button>}
              <Button className="border border-subtle" onClick={queue.clear}>Start over</Button>
            </div>
          )}
          {invalid && <p className="mt-3 text-center text-sm text-danger">{tool.slug === 'merge-pdf' ? 'Add at least two PDF files to merge.' : typeof settings.rangeError === 'string' ? settings.rangeError : 'Check the selected settings.'}</p>}
          <p className="mt-8 text-center text-sm text-muted">Your files are automatically deleted after processing.</p>
        </>
      )}
    </main>
  );
}

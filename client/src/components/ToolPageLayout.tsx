import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ToolDefinition } from '@shared/tools';
import { FileDropzone } from './FileDropzone';
import { FileList } from './FileList';
import { useFileQueue, type QueueOptions, type QueueStatus } from '../hooks/useFileQueue';
import { loadToolModule } from '../tools/loader';
import type { ToolModule, ToolSetting, ToolSettings } from '../tools/types';
import { addHistory } from '../services/history';
import { Button, Card, Spinner } from './ui/Primitives';

interface Capabilities {
  ocr?: boolean;
  libreoffice?: boolean;
  chrome?: boolean;
  poppler?: boolean;
  ghostscript?: boolean;
  ai?: boolean;
}

const requirements: Record<string, { keys: Array<keyof Capabilities>; message: string }> = {
  'ocr-pdf': { keys: ['ocr'], message: 'OCR language data is not configured on this deployment. Configure OCR_LANG_PATH before running recognition.' },
  'word-to-pdf': { keys: ['libreoffice', 'chrome'], message: 'No document conversion engine (LibreOffice or Chrome) is available on this deployment.' },
  'excel-to-pdf': { keys: ['libreoffice', 'chrome'], message: 'No spreadsheet conversion engine (LibreOffice or Chrome) is available on this deployment.' },
  'powerpoint-to-pdf': { keys: ['libreoffice'], message: 'LibreOffice is required for presentation conversion and is not available on this deployment.' },
  'html-to-pdf': { keys: ['chrome'], message: 'The Chrome rendering engine is not available on this deployment.' },
  'pdf-to-jpg': { keys: ['poppler', 'ghostscript'], message: 'No page rendering engine (Poppler or Ghostscript) is available on this deployment.' },
  'pdf-to-powerpoint': { keys: ['poppler', 'ghostscript'], message: 'No page rendering engine (Poppler or Ghostscript) is available on this deployment.' },
  'pdf-to-pdfa': { keys: ['ghostscript'], message: 'Ghostscript is required for PDF/A conversion and is not available on this deployment.' },
  'redact-pdf': { keys: ['poppler'], message: 'Poppler is required to locate and flatten redacted pages.' },
  'ai-summarizer': { keys: ['ai'], message: 'AI provider is not configured. Set AI_PROVIDER, AI_API_KEY, AI_BASE_URL, and AI_MODEL on the server.' },
  'translate-pdf': { keys: ['ai'], message: 'AI provider is not configured. Set AI_PROVIDER, AI_API_KEY, AI_BASE_URL, and AI_MODEL on the server.' },
};

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
  const [capabilities, setCapabilities] = useState<Capabilities>();
  const [settings, setSettings] = useState<ToolSettings>({ level: localStorage.getItem('pdfforge-default-level') ?? 'recommended' });
  const [hasAddedInitialFile, setHasAddedInitialFile] = useState(false);
  const recorded = useRef(new Set<string>());
  const standaloneRecorded = useRef<QueueStatus>();
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
    void fetch('/api/capabilities')
      .then((response) => response.json() as Promise<Capabilities>)
      .then(setCapabilities)
      .catch(() => setCapabilities(undefined));
  }, []);
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
  useEffect(() => {
    const job = queue.standalone;
    if (!job || (job.status !== 'COMPLETED' && job.status !== 'FAILED') || standaloneRecorded.current === job.status) return;
    standaloneRecorded.current = job.status;
    const result = job.result?.files[0];
    addHistory({
      fileName: job.label || 'HTML document',
      tool: tool.name,
      status: job.status === 'COMPLETED' ? 'completed' : 'failed',
      ...(result ? { downloadUrl: result.downloadUrl } : {}),
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
  }, [queue.standalone, tool.name]);
  const updateSetting = useCallback((key: string, value: ToolSetting) => setSettings((current) => {
    if (current[key] === value) return current;
    return { ...current, [key]: value };
  }), []);
  const request = module ? module.buildRequest(settings, queue.items) : undefined;
  const SettingsComponent = module?.Settings;
  const run = () => {
    if (!request) return;
    if (contentMode) {
      const label = settings.mode === 'url' ? String(settings.url ?? '') : 'Pasted HTML';
      void queue.processStandalone(label, request.options as QueueOptions);
      return;
    }
    void queue.process(request.operation, request.options as QueueOptions);
  };
  const retry = (id: string) => {
    if (request) void queue.retry(id, request.operation, request.options as QueueOptions);
  };
  const invalid = Boolean(settings.rangeError)
    || (tool.slug === 'merge-pdf' && queue.items.length < 2)
    || (tool.slug === 'compare-pdf' && queue.items.length !== 2)
    || (tool.slug === 'redact-pdf' && settings.confirmed !== true);
  const requirement = requirements[tool.slug];
  const unavailable = Boolean(requirement && capabilities && !requirement.keys.some((key) => capabilities[key]));
  const contentMode = tool.slug === 'html-to-pdf' && settings.mode !== 'file';
  const aiTool = tool.slug === 'ai-summarizer' || tool.slug === 'translate-pdf';
  const showActions = queue.items.length > 0 || contentMode;
  return (
    <main className="mx-auto max-w-shell px-gutter py-section">
      <header className="mb-10 text-center">
        <p className="mb-3 text-sm font-bold uppercase tracking-widest text-accent">{tool.category}</p>
        <h1 className="font-display text-4xl font-black sm:text-5xl">{tool.name}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-secondary">{tool.description}</p>
        <p className="mt-3 text-sm text-muted">Accepts {tool.accepts.join(', ')} · Up to 50 MB per file</p>
      </header>
      {tool.status === 'planned' && !aiTool ? (
        <Card className="mx-auto max-w-2xl border-accent/30 text-center">
          <p className="text-lg font-bold">{tool.slug === 'ocr-pdf' && capabilities && !capabilities.ocr ? 'OCR is not configured on this deployment.' : tool.slug === 'ai-summarizer' || tool.slug === 'translate-pdf' ? 'AI provider is not configured on this deployment.' : 'This tool is coming in a later phase.'}</p>
          <p className="mt-2 text-secondary">{tool.slug === 'ocr-pdf' && capabilities && !capabilities.ocr ? 'The server needs cached Tesseract language data before it can create a searchable text layer.' : tool.slug === 'ai-summarizer' || tool.slug === 'translate-pdf' ? 'Set AI_PROVIDER, AI_API_KEY, AI_BASE_URL, and AI_MODEL on the server to enable this workflow.' : 'The workspace shell is ready; processing will arrive in a later phase.'}</p>
        </Card>
      ) : (
        <>
          {tool.status === 'planned' && aiTool && (
            <Card className="mb-6 border-accent/30">
              <p className="font-bold">AI provider is not configured for this deployment.</p>
              <p className="mt-2 text-secondary">Set AI_PROVIDER, AI_API_KEY, AI_BASE_URL, and AI_MODEL on the server to enable this workflow. Your API key never reaches the browser.</p>
            </Card>
          )}
          {unavailable && requirement && (
            <Card className="mb-6 border-danger/40">
              <p className="font-bold">This tool cannot run on this deployment yet.</p>
              <p className="mt-2 text-secondary">{requirement.message}</p>
            </Card>
          )}
          {!contentMode && <FileDropzone accepts={tool.accepts} multiple={tool.multiple} onFiles={queue.add} />}
          {SettingsComponent ? <SettingsComponent items={queue.items} settings={settings} onChange={updateSetting} /> : <Card className="mt-6 flex justify-center"><Spinner /></Card>}
          {children}
          <FileList items={queue.items} onRemove={queue.remove} onRetry={retry} />
          {queue.standalone && (
            <Card className="mt-6">
              <p className="font-semibold">{queue.standalone.label || 'HTML document'}</p>
              <p className="mt-1 text-sm text-muted">{queue.standalone.status === 'PROCESSING' ? 'Rendering on the server…' : queue.standalone.status === 'COMPLETED' ? 'Ready to download.' : queue.standalone.error}</p>
              {queue.standalone.result?.files.map((file) => (
                <a key={file.fileId} className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent" href={file.downloadUrl} download>
                  Download {file.name}
                </a>
              ))}
            </Card>
          )}
          {showActions && (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button className="bg-accent text-on-accent" disabled={queue.processing || invalid || unavailable} onClick={run}>{queue.processing ? 'Processing…' : `Start ${tool.name}`}</Button>
              {queue.processing && <Button className="border border-subtle" onClick={queue.cancel}>Cancel</Button>}
              <Button className="border border-subtle" onClick={queue.clear}>Start over</Button>
            </div>
          )}
          {invalid && <p className="mt-3 text-center text-sm text-danger">{tool.slug === 'merge-pdf' ? 'Add at least two PDF files to merge.' : tool.slug === 'compare-pdf' ? 'Add exactly two PDF files to compare.' : tool.slug === 'redact-pdf' ? 'Confirm the irreversible redaction action before continuing.' : typeof settings.rangeError === 'string' ? settings.rangeError : 'Check the selected settings.'}</p>}
          <p className="mt-8 text-center text-sm text-muted">Your files are automatically deleted after processing.</p>
        </>
      )}
    </main>
  );
}

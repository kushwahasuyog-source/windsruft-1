import { useEffect, useState, type ReactNode } from 'react';
import type { ToolDefinition } from '@shared/tools';
import { FileDropzone } from './FileDropzone';
import { FileList } from './FileList';
import { useFileQueue } from '../hooks/useFileQueue';
import { Button, Card } from './ui/Primitives';

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
  const [level, setLevel] = useState<'low' | 'recommended' | 'high'>('recommended');
  const [hasAddedInitialFile, setHasAddedInitialFile] = useState(false);
  useEffect(() => {
    if (initialFile && !hasAddedInitialFile) {
      queue.add([initialFile]);
      setHasAddedInitialFile(true);
    }
  }, [initialFile, hasAddedInitialFile, queue]);
  const run = () => queue.process(
    tool.slug === 'compress-pdf' ? 'compress' : tool.slug.replace('-pdf', ''),
    tool.slug === 'compress-pdf' ? { level } : {},
  );
  return (
    <main className="mx-auto max-w-shell px-gutter py-section">
      <header className="mb-10 text-center">
        <p className="mb-3 text-sm font-bold uppercase tracking-widest text-accent">{tool.category}</p>
        <h1 className="font-display text-4xl font-black sm:text-5xl">{tool.name}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-secondary">{tool.description}</p>
        <p className="mt-3 text-sm text-muted">Accepts {tool.accepts.join(', ')} · Up to 50 MB</p>
      </header>
      {tool.status === 'planned' ? (
        <Card className="mx-auto max-w-2xl border-accent/30 text-center">
          <p className="text-lg font-bold">This tool is coming in this build.</p>
          <p className="mt-2 text-secondary">The full workspace shell is ready; processing will arrive in a later phase.</p>
        </Card>
      ) : (
        <>
          <FileDropzone accepts={tool.accepts} multiple={tool.multiple} onFiles={queue.add} />
          {tool.slug === 'compress-pdf' && (
            <Card className="mt-6">
              <label className="font-semibold" htmlFor="compression-level">Compression level</label>
              <select
                id="compression-level"
                value={level}
                onChange={(event) => setLevel(event.target.value as typeof level)}
                className="ml-3 rounded-md border border-subtle bg-surface p-2"
              >
                <option value="low">Low · keeps maximum quality</option>
                <option value="recommended">Recommended · balances quality and size</option>
                <option value="high">High · smallest practical file</option>
              </select>
            </Card>
          )}
          {children}
          <FileList items={queue.items} onRemove={queue.remove} onRetry={() => void run()} />
          {queue.items.length > 0 && (
            <div className="mt-6 flex justify-center gap-3">
              <Button className="bg-accent text-on-accent" onClick={() => void run()}>Start {tool.name}</Button>
              <Button className="border border-subtle" onClick={queue.clear}>Start over</Button>
            </div>
          )}
          <p className="mt-8 text-center text-sm text-muted">Your files are automatically deleted after processing.</p>
        </>
      )}
    </main>
  );
}

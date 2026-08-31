import { useEffect, useState } from 'react';
import type { QueueItem } from '../hooks/useFileQueue';
import { Button, Card } from './ui/Primitives';
import { PdfPreview } from './PdfPreview';

function humanSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImageThumbnail({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url ? <img className="h-20 w-16 rounded-md object-cover" src={url} alt="" /> : <div className="h-20 w-16 rounded-md bg-sunken" />;
}

function ComparisonReport({ url }: { url: string }) {
  const [report, setReport] = useState<{ pages?: Array<{ page: number; status: string; additions: string[]; deletions: string[] }>; message?: string }>();
  useEffect(() => {
    void fetch(`${url}?inline=1`).then((response) => response.json() as Promise<typeof report>).then(setReport).catch(() => undefined);
  }, [url]);
  if (!report) return <p className="text-sm text-muted">Loading comparison report…</p>;
  if (report.message && !report.pages) return <p className="text-sm text-danger">{report.message}</p>;
  return <div className="space-y-2">{report.pages?.map((page) => <div key={page.page} className="rounded border border-subtle p-2 text-sm"><span className="font-semibold">Page {page.page}: {page.status}</span>{page.deletions.length > 0 && <p className="text-danger">− {page.deletions.join(' ')}</p>}{page.additions.length > 0 && <p className="text-accent">+ {page.additions.join(' ')}</p>}</div>)}</div>;
}

function downloadAll(items: QueueItem[]): void {
  const firstResult = items.find((item) => item.result)?.result;
  if (firstResult?.downloadAllUrl) {
    window.open(firstResult.downloadAllUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  items.flatMap((item) => item.result?.files ?? []).forEach((file) => {
    const link = document.createElement('a');
    link.href = file.downloadUrl;
    link.download = file.name;
    link.click();
  });
}

export function FileList({
  items,
  onRemove,
  onRetry,
}: {
  items: QueueItem[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  if (!items.length) return null;
  const hasCompleted = items.some((item) => item.status === 'COMPLETED');
  const imageResults = items.flatMap((item) => item.result?.files ?? []).filter((file) => /\.(?:jpe?g|png|webp)$/i.test(file.name));
  const comparisonResults = items.flatMap((item) => item.result?.files ?? []).filter((file) => file.name === 'comparison.json');
  return (
    <Card className="mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Your files</h2>
        {hasCompleted && (
          <Button className="border border-subtle text-sm" onClick={() => downloadAll(items)}>Download All</Button>
        )}
      </div>
      {imageResults.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Converted image results">
          {imageResults.map((file) => (
            <figure key={file.fileId} className="rounded-lg border border-subtle p-2">
              <img className="aspect-[4/3] w-full rounded object-contain bg-sunken" src={`${file.downloadUrl}?inline=1`} alt={file.name} />
              <figcaption className="mt-2 flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{file.name}</span>
                <a className="shrink-0 font-semibold text-accent underline" href={file.downloadUrl} download={file.name}>Download</a>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {comparisonResults.length > 0 && <ComparisonReport url={comparisonResults[0].downloadUrl} />}
      {items.map((item) => {
        const result = item.result?.files[0];
        const isImage = item.file.type.startsWith('image/');
        return (
          <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-subtle p-3">
            <div className="w-16 shrink-0">{isImage ? <ImageThumbnail file={item.file} /> : <PdfPreview file={item.file} compact />}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{item.file.name}</p>
              <p className="text-sm text-muted">{humanSize(item.file.size)} · {item.file.type || 'PDF'} · {item.status}</p>
              {item.status === 'PROCESSING' && (
                <div className="mt-2">
                  {item.progress < 100 ? (
                    <>
                      <div className="h-1.5 overflow-hidden rounded-full bg-sunken"><div className="h-full bg-accent transition-all" style={{ width: `${item.progress}%` }} /></div>
                      <p className="mt-1 text-xs text-muted">Uploading {item.progress}%</p>
                    </>
                  ) : <p className="text-xs text-muted">Processing…</p>}
                </div>
              )}
              {result && result.originalSize !== undefined && result.compressedSize !== undefined && (
                <p className="mt-1 text-sm text-secondary">
                  Original {humanSize(result.originalSize)} → Compressed {humanSize(result.compressedSize)} → Saved {result.savedPercent ?? 0}%
                </p>
              )}
              {result?.engine === 'pdf-lib' && <p className="mt-1 text-xs text-muted">Used the built-in PDF engine because the server compression engine was unavailable.</p>}
              {item.error && <p className="mt-1 text-sm text-danger">{item.error}</p>}
            </div>
            {result && <a className="text-sm font-semibold text-accent underline" href={result.downloadUrl} download={result.name}>Download</a>}
            {item.status === 'FAILED' && <Button className="border border-subtle text-sm" onClick={() => onRetry(item.id)}>Retry</Button>}
            <Button className="border border-subtle text-sm" onClick={() => onRemove(item.id)}>Remove</Button>
          </div>
        );
      })}
    </Card>
  );
}

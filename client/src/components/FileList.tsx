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
  return (
    <Card className="mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Your files</h2>
        {hasCompleted && (
          <Button className="border border-subtle text-sm" onClick={() => downloadAll(items)}>Download All</Button>
        )}
      </div>
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

import type { QueueItem } from '../hooks/useFileQueue';
import { Button, Card } from './ui/Primitives';

function humanSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileList({
  items,
  onRemove,
  onRetry,
}: {
  items: QueueItem[];
  onRemove: (index: number) => void;
  onRetry: (index: number) => void;
}) {
  if (!items.length) return null;
  return (
    <Card className="mt-6 space-y-3">
      {items.map((item, index) => (
        <div key={`${item.file.name}-${item.file.size}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-subtle p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft text-xs text-accent">PDF</div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{item.file.name}</p>
            <p className="text-sm text-muted">{humanSize(item.file.size)} · {item.status}</p>
            {item.status === 'PROCESSING' && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken"><div className="h-full w-2/3 animate-pulse bg-accent" /></div>}
            {item.error && <p className="mt-1 text-sm text-danger">{item.error}</p>}
          </div>
          {item.result?.files[0] && <a className="text-sm font-semibold text-accent underline" href={item.result.files[0].downloadUrl}>Download</a>}
          {item.status === 'FAILED' && <Button className="border border-subtle text-sm" onClick={() => onRetry(index)}>Retry</Button>}
          <Button className="border border-subtle text-sm" onClick={() => onRemove(index)}>Remove</Button>
        </div>
      ))}
    </Card>
  );
}

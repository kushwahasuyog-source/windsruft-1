import { useEffect, useState } from 'react';
import { Button, Card } from './ui/Primitives';

export function PdfPreview({ file }: { file?: File }) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [pdfEngineReady, setPdfEngineReady] = useState(false);
  useEffect(() => {
    if (!file) return;
    void import('pdfjs-dist').then(() => setPdfEngineReady(true));
  }, [file]);
  if (!file) return null;
  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Preview</p>
          <p className="text-sm text-muted">{file.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="border border-subtle px-3" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(50, value - 10))}>−</Button>
          <span className="min-w-12 text-center text-sm">{zoom}%</span>
          <Button className="border border-subtle px-3" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(200, value + 10))}>+</Button>
          <Button className="border border-subtle px-3" aria-label="Previous page" onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</Button>
          <span className="text-sm">Page {page}</span>
          <Button className="border border-subtle px-3" aria-label="Next page" onClick={() => setPage((value) => value + 1)}>›</Button>
        </div>
      </div>
      <div className="mt-5 flex min-h-48 items-center justify-center rounded-lg border border-subtle bg-sunken text-sm text-muted">
        {pdfEngineReady ? 'PDF preview canvas ready' : 'Loading PDF preview…'}
      </div>
    </Card>
  );
}

export function FileCard(props: { file: File; status: string }) {
  return <div className="rounded-lg border border-subtle p-3"><span className="font-semibold">{props.file.name}</span><span className="ml-3 text-sm text-muted">{props.status}</span></div>;
}

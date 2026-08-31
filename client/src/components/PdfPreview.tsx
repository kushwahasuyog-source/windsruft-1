import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { Button, Card, Spinner } from './ui/Primitives';

export interface PdfPreviewProps {
  file?: File;
  source?: string;
  selectable?: boolean;
  selected?: number[];
  onSelectionChange?: (pages: number[]) => void;
  rotation?: number;
  onPageCount?: (pages: number) => void;
  compact?: boolean;
}

async function loadDocument(file: File | undefined, source: string | undefined): Promise<PDFDocumentProxy> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const data = file ? new Uint8Array(await file.arrayBuffer()) : undefined;
  return pdfjs.getDocument(data ? { data } : { url: source }).promise;
}

function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
  rotation: number,
): RenderTask {
  const viewport = page.getViewport({ scale, rotation });
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.ceil(viewport.width * pixelRatio);
  canvas.height = Math.ceil(viewport.height * pixelRatio);
  canvas.style.width = `${Math.ceil(viewport.width)}px`;
  canvas.style.height = `${Math.ceil(viewport.height)}px`;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable.');
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return page.render({ canvasContext: context, viewport });
}

function Thumbnail({
  document,
  pageNumber,
  selected,
  selectable,
  onSelect,
  onOpen,
}: {
  document: PDFDocumentProxy;
  pageNumber: number;
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const task = useRef<RenderTask>();
  useEffect(() => {
    const target = canvas.current;
    if (!target) return undefined;
    let stopped = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      void document.getPage(pageNumber).then((page) => {
        if (stopped || !canvas.current) return;
        task.current?.cancel();
        task.current = renderPage(page, canvas.current, 0.2, 0);
        task.current.promise.catch(() => undefined);
      });
      observer.disconnect();
    }, { rootMargin: '160px' });
    observer.observe(target);
    return () => {
      stopped = true;
      observer.disconnect();
      task.current?.cancel();
    };
  }, [document, pageNumber]);
  return (
    <button
      type="button"
      className={`relative shrink-0 rounded-lg border p-1 text-left transition ${selected ? 'border-accent ring-2 ring-accent' : 'border-subtle hover:border-accent'}`}
      aria-label={`Open page ${pageNumber}`}
      aria-pressed={selected}
      onClick={onOpen}
    >
      <canvas ref={canvas} className="block min-h-20 min-w-16 bg-white" />
      {selectable && (
        <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border border-subtle bg-surface/90">
          <input
            type="checkbox"
            tabIndex={-1}
            checked={selected}
            aria-label={`Select page ${pageNumber}`}
            onChange={onSelect}
            onClick={(event) => event.stopPropagation()}
          />
        </span>
      )}
      <span className="block px-1 pt-1 text-center text-xs text-muted">{pageNumber}</span>
    </button>
  );
}

export function PdfPreview({
  file,
  source,
  selectable = false,
  selected = [],
  onSelectionChange,
  rotation = 0,
  onPageCount,
  compact = false,
}: PdfPreviewProps) {
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(compact ? 45 : 100);
  const [viewRotation, setViewRotation] = useState(0);
  const [fitScale, setFitScale] = useState(1);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const task = useRef<RenderTask>();
  const container = useRef<HTMLDivElement>(null);
  const documentRef = useRef<PDFDocumentProxy>();

  useEffect(() => {
    if (!file && !source) return undefined;
    let stopped = false;
    setLoading(true);
    setError(false);
    setDocument(undefined);
    void documentRef.current?.destroy();
    documentRef.current = undefined;
    setPage(1);
    void loadDocument(file, source).then((loaded) => {
      if (stopped) {
        void loaded.destroy();
        return;
      }
      documentRef.current = loaded;
      setDocument(loaded);
      onPageCount?.(loaded.numPages);
      setLoading(false);
    }).catch(() => {
      if (!stopped) {
        setError(true);
        setLoading(false);
      }
    });
    return () => {
      stopped = true;
      task.current?.cancel();
      void documentRef.current?.destroy();
      documentRef.current = undefined;
    };
  }, [file, source]);

  useEffect(() => {
    if (!document || !canvas.current) return undefined;
    let stopped = false;
    void document.getPage(page).then((loadedPage) => {
      if (stopped || !canvas.current) return;
      task.current?.cancel();
      const viewport = loadedPage.getViewport({ scale: 1, rotation: rotation + viewRotation });
      const availableWidth = container.current?.clientWidth ?? viewport.width;
      const nextFit = Math.max(0.35, (availableWidth - 24) / viewport.width);
      setFitScale(nextFit);
      task.current = renderPage(loadedPage, canvas.current, zoom === 0 ? nextFit : zoom / 100, rotation + viewRotation);
      task.current.promise.catch(() => undefined);
    }).catch(() => setError(true));
    return () => {
      stopped = true;
      task.current?.cancel();
    };
  }, [document, page, zoom, rotation, viewRotation]);

  if (!file && !source) return null;
  if (error) return <Card className="mt-6 text-center text-danger">The PDF appears to be corrupted.</Card>;
  if (loading || !document) return <Card className="mt-6 flex min-h-40 items-center justify-center"><Spinner /></Card>;

  const effectiveZoom = zoom === 0 ? Math.round(fitScale * 100) : zoom;
  const togglePage = (pageNumber: number) => {
    const next = selected.includes(pageNumber)
      ? selected.filter((value) => value !== pageNumber)
      : [...selected, pageNumber].sort((a, b) => a - b);
    onSelectionChange?.(next);
  };

  return (
    <Card className={compact ? 'mt-0 p-2 shadow-none' : 'mt-6'}>
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Preview</p>
            <p className="text-sm text-muted">{file?.name ?? 'Generated PDF'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="border border-subtle px-3" aria-label="Zoom out" onClick={() => setZoom((value) => value === 0 ? 75 : Math.max(50, value - 10))}>−</Button>
            <span className="min-w-12 text-center text-sm">{effectiveZoom}%</span>
            <Button className="border border-subtle px-3" aria-label="Zoom in" onClick={() => setZoom((value) => value === 0 ? 125 : Math.min(220, value + 10))}>+</Button>
            <Button className="border border-subtle px-3" onClick={() => setZoom(0)}>Fit width</Button>
            <Button className="border border-subtle px-3" onClick={() => setViewRotation((value) => (value + 90) % 360)}>Rotate view</Button>
            <Button className="border border-subtle px-3" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>‹</Button>
            <span className="text-sm">Page {page} of {document.numPages}</span>
            <Button className="border border-subtle px-3" onClick={() => setPage((value) => Math.min(document.numPages, value + 1))} disabled={page === document.numPages}>›</Button>
          </div>
        </div>
      )}
      <div ref={container} className={`mt-4 overflow-auto rounded-lg bg-sunken p-3 ${compact ? 'max-h-44' : 'max-h-[34rem]'}`}>
        <canvas ref={canvas} className="mx-auto block bg-white shadow-soft" />
      </div>
      {!compact && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2" aria-label="Page thumbnails">
          {Array.from({ length: document.numPages }, (_value, index) => (
            <Thumbnail
              key={index + 1}
              document={document}
              pageNumber={index + 1}
              selected={selected.includes(index + 1)}
              selectable={selectable}
              onSelect={() => togglePage(index + 1)}
              onOpen={() => setPage(index + 1)}
            />
          ))}
        </div>
      )}
      {selectable && !compact && (
        <p className="mt-2 text-sm text-muted">{selected.length ? `${selected.length} page${selected.length === 1 ? '' : 's'} selected` : 'Select pages from the thumbnails.'}</p>
      )}
    </Card>
  );
}

export function FileCard(props: { file: File; status: string }) {
  return <div className="rounded-lg border border-subtle p-3"><span className="font-semibold">{props.file.name}</span><span className="ml-3 text-sm text-muted">{props.status}</span></div>;
}

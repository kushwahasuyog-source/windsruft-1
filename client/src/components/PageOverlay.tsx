import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { PdfPreview } from './PdfPreview';

export interface Rect {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FreehandPath {
  id: string;
  page: number;
  points: Array<{ x: number; y: number }>;
}

type OverlayMode = 'draw-rect' | 'move' | 'freehand' | 'point';

interface PageOverlayProps {
  file?: File;
  page: number;
  onPageChange: (page: number) => void;
  rects: Rect[];
  onRectsChange: (rects: Rect[]) => void;
  mode?: OverlayMode;
  paths?: FreehandPath[];
  onPathsChange?: (paths: FreehandPath[]) => void;
  selectedId?: string;
  onSelectedIdChange?: (id?: string) => void;
  renderRect?: (rect: Rect, selected: boolean) => ReactNode;
  renderPath?: (path: FreehandPath, selected: boolean) => ReactNode;
  minWidth?: number;
  minHeight?: number;
}

type DragState =
  | { kind: 'create'; startX: number; startY: number; rect: Rect }
  | { kind: 'move'; startX: number; startY: number; original: Rect }
  | { kind: 'resize'; startX: number; startY: number; original: Rect; corner: string }
  | { kind: 'freehand'; path: FreehandPath };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultRect(page: number, x: number, y: number): Rect {
  return { id: makeId('rect'), page, x, y, width: 1, height: 1 };
}

export function PageOverlay({
  file,
  page,
  onPageChange,
  rects,
  onRectsChange,
  mode = 'move',
  paths = [],
  onPathsChange,
  selectedId,
  onSelectedIdChange,
  renderRect,
  renderPath,
  minWidth = 8,
  minHeight = 8,
}: PageOverlayProps) {
  const [pageCount, setPageCount] = useState(1);
  const metrics = useRef({ scale: 1, width: 612, height: 792 });
  const [internalSelected, setInternalSelected] = useState<string>();
  const dragRef = useRef<DragState>();
  const rectsRef = useRef(rects);
  const pathsRef = useRef(paths);
  rectsRef.current = rects;
  pathsRef.current = paths;
  const root = useRef<HTMLDivElement>(null);
  const selected = selectedId ?? internalSelected;
  const setSelected = (id?: string) => {
    setInternalSelected(id);
    onSelectedIdChange?.(id);
  };

  const pointFromEvent = (event: { clientX: number; clientY: number }) => {
    const bounds = root.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: clamp((event.clientX - bounds.left) / metrics.current.scale, 0, metrics.current.width),
      y: clamp(metrics.current.height - (event.clientY - bounds.top) / metrics.current.scale, 0, metrics.current.height),
    };
  };

  const updateRect = (next: Rect) => {
    onRectsChange(rectsRef.current.map((item) => item.id === next.id ? next : item));
  };

  const setDrag = (next?: DragState) => {
    dragRef.current = next;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    if (mode === 'freehand') {
      const path = { id: makeId('path'), page, points: [point] };
      setSelected(path.id);
      setDrag({ kind: 'freehand', path });
      onPathsChange?.([...pathsRef.current, path]);
      return;
    }
    if (mode === 'draw-rect' || mode === 'point') {
      const rect = defaultRect(page, point.x, point.y);
      setSelected(rect.id);
      setDrag({ kind: 'create', startX: point.x, startY: point.y, rect });
      onRectsChange([...rectsRef.current, rect]);
    } else {
      setSelected(undefined);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = pointFromEvent(event);
    if (drag.kind === 'freehand') {
      const nextPath = { ...drag.path, points: [...drag.path.points, point] };
      setDrag({ kind: 'freehand', path: nextPath });
      onPathsChange?.(pathsRef.current.map((item) => item.id === nextPath.id ? nextPath : item));
      return;
    }
    if (drag.kind === 'create') {
      const x = Math.min(drag.startX, point.x);
      const y = Math.min(drag.startY, point.y);
      const next = { ...drag.rect, x, y, width: Math.abs(point.x - drag.startX), height: Math.abs(point.y - drag.startY) };
      updateRect(next);
      setDrag({ ...drag, rect: next });
      return;
    }
    if (drag.kind === 'move') {
      const next = {
        ...drag.original,
        x: clamp(drag.original.x + point.x - drag.startX, 0, metrics.current.width - drag.original.width),
        y: clamp(drag.original.y + point.y - drag.startY, 0, metrics.current.height - drag.original.height),
      };
      updateRect(next);
      return;
    }
    const original = drag.original;
    const right = original.x + original.width;
    const top = original.y + original.height;
    const left = drag.corner.includes('left') ? clamp(point.x, 0, right - minWidth) : original.x;
    const nextRight = drag.corner.includes('right') ? clamp(point.x, left + minWidth, metrics.current.width) : right;
    const bottom = drag.corner.includes('bottom') ? clamp(point.y, 0, top - minHeight) : original.y;
    const nextTop = drag.corner.includes('top') ? clamp(point.y, bottom + minHeight, metrics.current.height) : top;
    updateRect({ ...original, x: left, y: bottom, width: nextRight - left, height: nextTop - bottom });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag?.kind === 'create' && (drag.rect.width < minWidth || drag.rect.height < minHeight)) {
      onRectsChange(rectsRef.current.filter((item) => item.id !== drag.rect.id));
      setSelected(undefined);
    }
    setDrag(undefined);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!selected) return;
    const item = rects.find((rect) => rect.id === selected);
    const path = paths.find((candidate) => candidate.id === selected);
    if (!item && path && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      onPathsChange?.(paths.filter((candidate) => candidate.id !== selected));
      setSelected(undefined);
      return;
    }
    if (!item) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onRectsChange(rects.filter((rect) => rect.id !== selected));
      setSelected(undefined);
      return;
    }
    const step = event.shiftKey ? 10 : 1;
    const delta = event.key === 'ArrowLeft' ? { x: -step, y: 0 } : event.key === 'ArrowRight' ? { x: step, y: 0 } : event.key === 'ArrowUp' ? { x: 0, y: step } : event.key === 'ArrowDown' ? { x: 0, y: -step } : undefined;
    if (!delta) return;
    event.preventDefault();
    updateRect({ ...item, x: clamp(item.x + delta.x, 0, metrics.current.width - item.width), y: clamp(item.y + delta.y, 0, metrics.current.height - item.height) });
  };

  const selectedRect = rects.find((rect) => rect.id === selected);
  const input = (key: keyof Rect, value: string) => {
    if (!selectedRect || key === 'id' || key === 'page') return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    updateRect({ ...selectedRect, [key]: Math.max(0, numeric) });
  };

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-semibold">Page
          <select className="ml-2 rounded border border-subtle bg-surface p-2 font-normal" value={page} onChange={(event) => onPageChange(Number(event.target.value))}>
            {Array.from({ length: pageCount }, (_value, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
          </select>
        </label>
        <span className="text-xs text-muted">Drag to draw, move, resize, or select. Arrow keys nudge; Shift moves 10 points; Delete removes.</span>
      </div>
      <PdfPreview
        file={file}
        page={page}
        onPageChange={onPageChange}
        onPageCount={setPageCount}
        overlay={({ scale, width, height }) => {
          metrics.current = { scale, width, height };
          return (
            <div
              ref={root}
              className="relative h-full w-full touch-none"
              tabIndex={0}
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              aria-label="PDF direct manipulation canvas"
            >
              {rects.filter((rect) => rect.page === page).map((rect) => {
                const left = rect.x * scale;
                const top = (height - rect.y - rect.height) * scale;
                const isSelected = rect.id === selected;
                return (
                  <div
                    key={rect.id}
                    className={`absolute cursor-move border-2 ${isSelected ? 'border-accent bg-accent/10' : 'border-accent/70 bg-accent/5'}`}
                    style={{ left, top, width: rect.width * scale, height: rect.height * scale }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      root.current?.setPointerCapture(event.pointerId);
                      setSelected(rect.id);
                      const point = pointFromEvent(event);
                      setDrag({ kind: 'move', startX: point.x, startY: point.y, original: rect });
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {renderRect?.(rect, isSelected)}
                    {isSelected && ['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => (
                      <button
                        key={corner}
                        type="button"
                        aria-label={`Resize ${corner}`}
                        className={`absolute h-3 w-3 rounded-full border border-accent bg-surface ${corner.includes('top') ? '-top-2' : '-bottom-2'} ${corner.includes('left') ? '-left-2' : '-right-2'}`}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          root.current?.setPointerCapture(event.pointerId);
                          const point = pointFromEvent(event);
                          setDrag({ kind: 'resize', startX: point.x, startY: point.y, original: rect, corner });
                        }}
                      />
                    ))}
                  </div>
                );
              })}
              {paths.filter((path) => path.page === page).map((path) => {
                const points = path.points.map((point) => `${point.x * scale},${(height - point.y) * scale}`).join(' ');
                return <svg key={path.id} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"><polyline points={points} fill="none" stroke="rgb(23 32 51)" strokeWidth="3" style={{ pointerEvents: 'stroke' }} onPointerDown={(event) => { event.stopPropagation(); setSelected(path.id); }} /></svg>;
              })}
              {renderPath && paths.filter((path) => path.page === page).map((path) => renderPath(path, path.id === selected))}
            </div>
          );
        }}
      />
      {selectedRect && (
        <div className="grid grid-cols-4 gap-2 rounded border border-subtle bg-surface p-3">
          {(['x', 'y', 'width', 'height'] as const).map((key) => (
            <label key={key} className="text-xs font-semibold uppercase">{key}
              <input className="mt-1 w-full rounded border border-subtle bg-surface p-2 text-sm font-normal" type="number" min="0" value={selectedRect[key]} onChange={(event) => input(key, event.target.value)} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

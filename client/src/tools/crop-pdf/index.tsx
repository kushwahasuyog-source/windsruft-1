import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { PdfPreview } from '../../components/PdfPreview';
import { Card } from '../../components/ui/Primitives';
import type { ToolModule, ToolRequest, ToolSettingsProps } from '../types';

type Box = { x: number; y: number; width: number; height: number };
type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

const fallback: Box = { x: 36, y: 36, width: 540, height: 720 };

function readBox(value: unknown): Box {
  try {
    const parsed = JSON.parse(String(value ?? '')) as Box;
    if ([parsed.x, parsed.y, parsed.width, parsed.height].every((entry) => Number.isFinite(entry))) return parsed;
  } catch {
    return fallback;
  }
  return fallback;
}

function clampBox(box: Box, width: number, height: number): Box {
  const boxWidth = Math.min(Math.max(20, box.width), width);
  const boxHeight = Math.min(Math.max(20, box.height), height);
  return {
    width: boxWidth,
    height: boxHeight,
    x: Math.min(Math.max(0, box.x), width - boxWidth),
    y: Math.min(Math.max(0, box.y), height - boxHeight),
  };
}

function CropRectangle({
  box,
  scale,
  pageHeight,
  pageWidth,
  onChange,
}: {
  box: Box;
  scale: number;
  pageHeight: number;
  pageWidth: number;
  onChange: (box: Box) => void;
}) {
  const drag = useRef<{ handle: Handle; startX: number; startY: number; origin: Box }>();
  const begin = (handle: Handle) => (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { handle, startX: event.clientX, startY: event.clientY, origin: box };
  };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active) return;
    const deltaX = (event.clientX - active.startX) / scale;
    const deltaY = -(event.clientY - active.startY) / scale;
    const origin = active.origin;
    const next: Box = active.handle === 'move'
      ? { ...origin, x: origin.x + deltaX, y: origin.y + deltaY }
      : active.handle === 'se'
        ? { ...origin, width: origin.width + deltaX, height: origin.height - deltaY, y: origin.y + deltaY }
        : active.handle === 'ne'
          ? { ...origin, width: origin.width + deltaX, height: origin.height + deltaY }
          : active.handle === 'sw'
            ? { x: origin.x + deltaX, y: origin.y + deltaY, width: origin.width - deltaX, height: origin.height - deltaY }
            : { x: origin.x + deltaX, y: origin.y, width: origin.width - deltaX, height: origin.height + deltaY };
    onChange(clampBox(next, pageWidth, pageHeight));
  };
  const end = () => {
    drag.current = undefined;
  };
  const handleClass = 'absolute h-3 w-3 rounded-sm border border-surface bg-accent';
  return (
    <div
      role="presentation"
      className="absolute cursor-move border-2 border-accent bg-accent/10 touch-none"
      style={{
        left: box.x * scale,
        top: (pageHeight - box.y - box.height) * scale,
        width: box.width * scale,
        height: box.height * scale,
      }}
      onPointerDown={begin('move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span className={`${handleClass} -left-1.5 -top-1.5 cursor-nwse-resize`} onPointerDown={begin('nw')} onPointerMove={move} onPointerUp={end} />
      <span className={`${handleClass} -right-1.5 -top-1.5 cursor-nesw-resize`} onPointerDown={begin('ne')} onPointerMove={move} onPointerUp={end} />
      <span className={`${handleClass} -bottom-1.5 -left-1.5 cursor-nesw-resize`} onPointerDown={begin('sw')} onPointerMove={move} onPointerUp={end} />
      <span className={`${handleClass} -bottom-1.5 -right-1.5 cursor-nwse-resize`} onPointerDown={begin('se')} onPointerMove={move} onPointerUp={end} />
    </div>
  );
}

function Settings({ items, settings, onChange }: ToolSettingsProps) {
  const file = items[0]?.file;
  const [count, setCount] = useState(0);
  const box = readBox(settings.box);
  const applyTo = String(settings.applyTo ?? 'page');
  const update = (next: Box) => onChange('box', JSON.stringify({
    x: Math.round(next.x),
    y: Math.round(next.y),
    width: Math.round(next.width),
    height: Math.round(next.height),
  }));
  const field = (key: keyof Box, value: number) => update({ ...box, [key]: value });
  return (
    <Card className="mt-6">
      <h2 className="font-semibold">Crop rectangle</h2>
      <p className="mt-1 text-sm text-secondary">Drag the rectangle or its corners on the page, or nudge it with the arrow keys. Coordinates use PDF points with the origin at bottom-left and are clamped to each page.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(['x', 'y', 'width', 'height'] as const).map((key) => (
          <label key={key} className="text-sm font-semibold">
            {key}
            <input
              className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal"
              type="number"
              min={key === 'width' || key === 'height' ? 20 : 0}
              value={box[key]}
              onChange={(event) => field(key, Number(event.target.value))}
            />
          </label>
        ))}
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm"><input type="radio" name="crop-scope" checked={applyTo === 'page'} onChange={() => onChange('applyTo', 'page')} />Apply to this page</label>
      <label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" name="crop-scope" checked={applyTo === 'all'} onChange={() => onChange('applyTo', 'all')} />Apply to all pages</label>
      {applyTo === 'page' && (
        <label className="mt-3 block text-sm font-semibold">
          Page
          <input className="mt-2 w-32 rounded-lg border border-subtle bg-surface p-2 font-normal" type="number" min="1" max={count || undefined} value={Number(settings.page ?? 1)} onChange={(event) => onChange('page', Number(event.target.value))} />
        </label>
      )}
      <div
        className="mt-4 rounded-lg outline-none ring-accent focus-visible:ring-2"
        tabIndex={0}
        aria-label="Crop preview; use arrow keys to nudge, shift and arrow keys to resize"
        onKeyDown={(event) => {
          const step = event.altKey ? 10 : 1;
          const resize = event.shiftKey;
          if (event.key === 'ArrowLeft') update(resize ? { ...box, width: box.width - step } : { ...box, x: box.x - step });
          else if (event.key === 'ArrowRight') update(resize ? { ...box, width: box.width + step } : { ...box, x: box.x + step });
          else if (event.key === 'ArrowUp') update(resize ? { ...box, height: box.height + step } : { ...box, y: box.y + step });
          else if (event.key === 'ArrowDown') update(resize ? { ...box, height: box.height - step } : { ...box, y: box.y - step });
          else return;
          event.preventDefault();
        }}
      >
        {file && (
          <PdfPreview
            file={file}
            onPageCount={setCount}
            overlay={({ scale, width, height }) => (
              <CropRectangle box={clampBox(box, width, height)} scale={scale} pageWidth={width} pageHeight={height} onChange={update} />
            )}
          />
        )}
      </div>
    </Card>
  );
}

export { Settings };
export const buildRequest = (settings: Parameters<ToolModule['buildRequest']>[0]): ToolRequest => ({
  operation: 'crop',
  options: {
    box: JSON.stringify(readBox(settings.box)),
    applyTo: String(settings.applyTo ?? 'page'),
    page: Number(settings.page ?? 1),
  },
});
const module: ToolModule = { Settings, buildRequest };
export default module;

import { useEffect, useMemo, useState } from 'react';
import { PdfPreview } from '../../components/PdfPreview';
import { Button, Card } from '../../components/ui/Primitives';
import type { ToolModule, ToolRequest, ToolSettingsProps } from '../types';

const positions = ['top-left', 'top-center', 'top-right', 'middle-left', 'center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right', 'tiled'] as const;

function Settings({ items, settings, onChange }: ToolSettingsProps) {
  const file = items[0]?.file;
  const [count, setCount] = useState(0);
  const kind = String(settings.kind ?? 'text');
  const selected = settings.pages ? JSON.parse(String(settings.pages)) as number[] : [];
  const allPages = settings.allPages !== false && settings.allPages !== 'false';
  const updatePages = (pages: number[]) => onChange('pages', JSON.stringify([...new Set(pages)].sort((a, b) => a - b)));
  const watermarkImage = settings.imageFile instanceof File ? settings.imageFile : undefined;
  const imageUrl = useMemo(() => (watermarkImage ? URL.createObjectURL(watermarkImage) : undefined), [watermarkImage]);
  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);
  return (
    <Card className="mt-6">
      <div className="flex gap-2 border-b border-subtle pb-3"><button type="button" className={`border-b-2 px-3 py-2 ${kind === 'text' ? 'border-accent' : 'border-transparent'}`} onClick={() => onChange('kind', 'text')}>Text watermark</button><button type="button" className={`border-b-2 px-3 py-2 ${kind === 'image' ? 'border-accent' : 'border-transparent'}`} onClick={() => onChange('kind', 'image')}>Image watermark</button></div>
      {kind === 'text' ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold md:col-span-2">Text<input className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal" value={String(settings.text ?? '')} onChange={(event) => onChange('text', event.target.value)} placeholder="CONFIDENTIAL" /></label>
          <label className="text-sm font-semibold">Font<select className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal" value={String(settings.fontFamily ?? 'Helvetica')} onChange={(event) => onChange('fontFamily', event.target.value)}><option>Helvetica</option><option>Times</option><option>Courier</option></select></label>
          <label className="text-sm font-semibold">Size<input className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal" type="number" min="6" max="160" value={Number(settings.fontSize ?? 36)} onChange={(event) => onChange('fontSize', Number(event.target.value))} /></label>
          <label className="text-sm font-semibold">Color<input className="mt-2 h-10 w-full rounded-lg border border-subtle bg-surface p-1" type="color" value={String(settings.color ?? '#4f46e5')} onChange={(event) => onChange('color', event.target.value)} /></label>
        </div>
      ) : (
        <div className="mt-4"><label className="text-sm font-semibold">PNG or JPG image<input className="mt-2 block w-full rounded-lg border border-subtle bg-surface p-2 font-normal" type="file" accept="image/png,image/jpeg" onChange={(event) => { const image = event.target.files?.[0]; if (image) onChange('imageFile', image); }} /></label><label className="mt-4 block text-sm font-semibold">Scale (%)<input className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal" type="number" min="1" max="200" value={Number(settings.scale ?? 35)} onChange={(event) => onChange('scale', Number(event.target.value))} /></label></div>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Opacity<input className="mt-2 w-full" type="range" min="0" max="1" step="0.05" value={Number(settings.opacity ?? 0.3)} onChange={(event) => onChange('opacity', Number(event.target.value))} /></label><label className="text-sm font-semibold">Rotation<input className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal" type="number" min="-360" max="360" value={Number(settings.rotation ?? 0)} onChange={(event) => onChange('rotation', Number(event.target.value))} /></label></div>
      <label className="mt-4 block text-sm font-semibold">Position<select className="mt-2 w-full rounded-lg border border-subtle bg-surface p-2 font-normal" value={String(settings.position ?? 'center')} onChange={(event) => onChange('position', event.target.value)}>{positions.map((position) => <option key={position} value={position}>{position.replace('-', ' ')}</option>)}</select></label>
      <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={allPages} onChange={(event) => onChange('allPages', event.target.checked)} />Apply to all pages ({count || '…'})</label>
      {file && (
        <PdfPreview
          file={file}
          selectable={!allPages}
          selected={selected}
          onSelectionChange={updatePages}
          onPageCount={setCount}
          overlay={({ scale, width, height }) => {
            const position = String(settings.position ?? 'center');
            const opacity = Number(settings.opacity ?? 0.3);
            const rotation = Number(settings.rotation ?? 0);
            const horizontal = position.endsWith('left') ? 0.15 : position.endsWith('right') ? 0.85 : 0.5;
            const vertical = position.startsWith('top') ? 0.18 : position.startsWith('bottom') ? 0.82 : 0.5;
            const anchor = {
              left: `${horizontal * 100}%`,
              top: `${vertical * 100}%`,
              transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
            };
            if (kind === 'image') {
              if (!imageUrl) return null;
              return position === 'tiled' ? (
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 place-items-center" style={{ opacity }}>
                  {Array.from({ length: 9 }, (_value, index) => (
                    <img key={index} src={imageUrl} alt="" style={{ width: (Number(settings.scale ?? 35) / 100) * width * scale * 0.5, transform: `rotate(${-rotation}deg)` }} />
                  ))}
                </div>
              ) : (
                <img src={imageUrl} alt="" className="absolute" style={{ ...anchor, opacity, width: (Number(settings.scale ?? 35) / 100) * width * scale }} />
              );
            }
            const label = String(settings.text ?? '');
            if (!label) return null;
            const style = {
              color: String(settings.color ?? '#4f46e5'),
              fontFamily: String(settings.fontFamily ?? 'Helvetica'),
              fontSize: Number(settings.fontSize ?? 36) * scale,
              opacity,
              lineHeight: 1,
            };
            return position === 'tiled' ? (
              <div className="absolute inset-0 overflow-hidden">
                {Array.from({ length: Math.ceil(height / (Number(settings.fontSize ?? 36) * 3)) }, (_row, row) => (
                  <div key={row} className="flex justify-between" style={{ marginTop: Number(settings.fontSize ?? 36) * 2 * scale }}>
                    {Array.from({ length: 3 }, (_column, column) => (
                      <span key={column} className="whitespace-nowrap" style={{ ...style, transform: `rotate(${-rotation}deg)` }}>{label}</span>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <span className="absolute whitespace-nowrap" style={{ ...anchor, ...style }}>{label}</span>
            );
          }}
        />
      )}
      {!allPages && !selected.length && <p className="mt-2 text-sm text-danger">Select at least one page.</p>}
      <Button className="mt-3 border border-subtle text-sm" onClick={() => updatePages(Array.from({ length: count }, (_value, index) => index + 1))} disabled={!count}>Select all pages</Button>
    </Card>
  );
}

export { Settings };
export const buildRequest = (settings: Parameters<ToolModule['buildRequest']>[0]): ToolRequest => ({
  operation: 'watermark',
  options: {
    kind: String(settings.kind ?? 'text'),
    text: String(settings.text ?? ''),
    fontFamily: String(settings.fontFamily ?? 'Helvetica'),
    fontSize: Number(settings.fontSize ?? 36),
    color: String(settings.color ?? '#4f46e5'),
    opacity: Number(settings.opacity ?? 0.3),
    rotation: Number(settings.rotation ?? 0),
    position: String(settings.position ?? 'center'),
    scale: Number(settings.scale ?? 35),
    pages: settings.allPages === false || settings.allPages === 'false' ? String(settings.pages ?? '[]') : 'all',
    ...(settings.imageFile instanceof File ? { imageFile: settings.imageFile } : {}),
  },
});
const module: ToolModule = { Settings, buildRequest };
export default module;

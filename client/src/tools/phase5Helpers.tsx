import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { ToolSettingsProps } from './types';
import { Card } from '../components/ui/Primitives';
import { PageOverlay, type FreehandPath, type Rect } from '../components/PageOverlay';
import { apiClient } from '../services/apiClient';

function readJson<T>(value: unknown, fallback: T): T {
  try {
    return JSON.parse(String(value ?? '')) as T;
  } catch {
    return fallback;
  }
}

function rectFromSettings(settings: ToolSettingsProps['settings'], id: string, page: number): Rect {
  const saved = readJson<Partial<Rect>>(settings.rect, {});
  return { id, page: Number(saved.page ?? page), x: Number(saved.x ?? 72), y: Number(saved.y ?? 72), width: Number(saved.width ?? 180), height: Number(saved.height ?? 60) };
}

function SignatureCanvas({ onCommit }: { onCommit: (file: File) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = canvas.current?.getBoundingClientRect();
    return bounds ? { x: event.clientX - bounds.left, y: event.clientY - bounds.top } : { x: 0, y: 0 };
  };
  const commit = () => {
    canvas.current?.toBlob((blob) => {
      if (blob) onCommit(new File([blob], 'signature.png', { type: 'image/png' }));
    }, 'image/png');
  };
  return <canvas ref={canvas} width={520} height={170} className="w-full max-w-xl touch-none rounded border border-subtle bg-white" aria-label="Draw signature"
    onPointerDown={(event) => {
      const target = canvas.current; const context = target?.getContext('2d'); if (!target || !context) return;
      target.setPointerCapture(event.pointerId); const { x, y } = point(event);
      context.strokeStyle = '#172033'; context.lineWidth = 3; context.lineCap = 'round'; context.beginPath(); context.moveTo(x, y); setDrawing(true);
    }}
    onPointerMove={(event) => {
      if (!drawing) return; const context = canvas.current?.getContext('2d'); if (!context) return;
      const { x, y } = point(event); context.lineTo(x, y); context.stroke();
    }}
    onPointerUp={(event) => {
      if (canvas.current?.hasPointerCapture(event.pointerId)) canvas.current.releasePointerCapture(event.pointerId); setDrawing(false); commit();
    }}
    onPointerCancel={() => setDrawing(false)}
  />;
}

export function SignSettings({ items, settings, onChange }: ToolSettingsProps) {
  const kind = settings.kind === 'image' ? 'image' : 'text';
  const page = Number(settings.page ?? 1);
  const [rect, setRect] = useState<Rect>(() => rectFromSettings(settings, 'signature', page));
  const image = settings.imageFile instanceof File ? settings.imageFile : undefined;
  const [imageUrl, setImageUrl] = useState('');
  useEffect(() => {
    if (!image) { setImageUrl(''); return undefined; }
    const url = URL.createObjectURL(image); setImageUrl(url); return () => URL.revokeObjectURL(url);
  }, [image]);
  const saveRect = (next: Rect) => {
    setRect(next); onChange('page', next.page); onChange('rect', JSON.stringify(next));
    onChange('x', next.x); onChange('y', next.y); onChange('width', next.width); onChange('height', next.height);
  };
  return <Card className="mt-6 space-y-4">
    <p className="text-sm text-secondary">This creates a visual signature, not a cryptographic digital signature. Drag the signature on the page and use the corner handles to resize it.</p>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Signature mode<select className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" value={kind} onChange={(event) => onChange('kind', event.target.value)}><option value="text">Type</option><option value="image">Draw or upload</option></select></label><label className="text-sm font-semibold">Page<input className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" type="number" min="1" value={page} onChange={(event) => onChange('page', Number(event.target.value))} /></label></div>
    {kind === 'text' ? <><label className="text-sm font-semibold">Signature text<input className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" value={String(settings.text ?? '')} onChange={(event) => onChange('text', event.target.value)} placeholder="Your name" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Font<select className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" value={String(settings.fontFamily ?? 'Helvetica')} onChange={(event) => onChange('fontFamily', event.target.value)}><option>Helvetica</option><option>Times</option><option>Courier</option></select></label><label className="text-sm font-semibold">Font size<input className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" type="number" min="6" max="160" value={Number(settings.fontSize ?? 24)} onChange={(event) => onChange('fontSize', Number(event.target.value))} /></label></div></> : <><SignatureCanvas onCommit={(file) => onChange('imageFile', file)} /><label className="text-sm font-semibold">Upload signature image<input className="mt-2 block text-sm font-normal" type="file" accept="image/png,image/jpeg" onChange={(event) => onChange('imageFile', event.target.files?.[0] as File)} /></label></>}
    {items[0] && <PageOverlay file={items[0].file} page={page} onPageChange={(next) => { onChange('page', next); setRect((current) => ({ ...current, page: next })); }} rects={[{ ...rect, page }]} onRectsChange={(next) => { if (next[0]) saveRect({ ...next[0], page }); }} mode="move" renderRect={() => kind === 'text' ? <span className="block h-full overflow-hidden whitespace-nowrap p-2 text-xl">{String(settings.text ?? 'Signature')}</span> : imageUrl ? <img className="h-full w-full object-contain" src={imageUrl} alt="Signature preview" /> : <span className="p-2 text-xs text-muted">Draw or upload a signature</span>} />}
  </Card>;
}

interface RedactionBox extends Rect { proposed?: boolean }

function RedactionDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
      if (event.key === 'Tab') {
        const focusable = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'));
        if (focusable.length < 2) return;
        const index = focusable.indexOf(document.activeElement as HTMLButtonElement);
        const next = focusable[(index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length];
        event.preventDefault();
        next.focus();
      }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="redaction-title"><div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-lift"><h2 id="redaction-title" className="text-lg font-bold">Confirm permanent redaction</h2><p className="mt-2 text-sm text-secondary">Covered content will be removed and affected pages will become images. This cannot be undone.</p><div className="mt-5 flex justify-end gap-3"><button ref={cancel} type="button" className="rounded border border-subtle px-4 py-2" onClick={onCancel}>Cancel</button><button type="button" className="rounded bg-danger px-4 py-2 text-white" onClick={onConfirm}>Redact permanently</button></div></div></div>;
}

export function RedactSettings({ items, settings, onChange }: ToolSettingsProps) {
  const rawBoxes = readJson<RedactionBox[]>(settings.boxes, []);
  const rects: RedactionBox[] = rawBoxes.map((box, index) => ({ ...box, id: box.id ?? `redaction-${index}` }));
  const [page, setPage] = useState(Number(settings.page ?? 1));
  const [dialog, setDialog] = useState(false);
  const save = (next: RedactionBox[]) => onChange('boxes', JSON.stringify(next.map((box) => ({ ...box, proposed: box.proposed ?? rects.find((item) => item.id === box.id)?.proposed }))));
  const lastSearch = useRef('');
  useEffect(() => {
    const file = items[0]?.file;
    const searchText = String(settings.searchText ?? '').trim();
    const key = `${file?.name ?? ''}:${searchText}:${String(settings.matchCase ?? false)}`;
    if (!file || !searchText || key === lastSearch.current) return;
    lastSearch.current = key;
    void apiClient.redactMatches(file, searchText, settings.matchCase === true).then((result) => {
      const proposed = result.boxes.map((box, index) => ({ ...box, id: `match-${index}-${key}`, proposed: true }));
      if (proposed.length) save([...rects, ...proposed]);
    }).catch(() => undefined);
  }, [items, settings.searchText, settings.matchCase]);
  return <Card className="mt-6 space-y-4"><p className="text-sm text-secondary">Draw, move, resize, or delete redaction boxes directly on the page. Redacted pages are flattened images and lose selectable text.</p><label className="text-sm font-semibold">Find text<input className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" value={String(settings.searchText ?? '')} onChange={(event) => onChange('searchText', event.target.value)} placeholder="Text to permanently remove" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(settings.matchCase)} onChange={(event) => onChange('matchCase', event.target.checked)} /> Match case</label>{items[0] && <PageOverlay file={items[0].file} page={page} onPageChange={setPage} rects={rects} onRectsChange={save} mode="draw-rect" selectedId={String(settings.selectedRect ?? '')} onSelectedIdChange={(id) => onChange('selectedRect', id ?? '')} renderRect={(rect) => rects.find((box) => box.id === rect.id)?.proposed ? <span className="block h-full w-full border-2 border-dashed border-danger bg-danger/20" /> : <span className="block h-full w-full bg-black/70" />} />}<div className="space-y-2">{rects.map((box) => <div key={box.id} className="flex items-center gap-2"><button type="button" className={`flex-1 rounded border p-2 text-left text-sm ${String(settings.selectedRect ?? '') === box.id ? 'border-accent bg-accent/5' : 'border-subtle'}`} onClick={() => { onChange('selectedRect', box.id); setPage(box.page); }}>Page {box.page}: X {Math.round(box.x)}, Y {Math.round(box.y)}, {Math.round(box.width)} × {Math.round(box.height)}{box.proposed ? ' · proposed match' : ''}</button><button type="button" className="rounded border border-subtle px-3 py-2 text-sm" onClick={() => save(rects.filter((item) => item.id !== box.id))}>Remove</button></div>)}</div><div className="flex items-center justify-between gap-3"><span className="text-sm text-muted">{rects.length} box{rects.length === 1 ? '' : 'es'} queued</span><button type="button" className="rounded bg-danger px-4 py-2 text-sm font-semibold text-white" disabled={!rects.length && !String(settings.searchText ?? '').trim()} onClick={() => setDialog(true)}>Apply redaction</button></div>{dialog && <RedactionDialog onCancel={() => setDialog(false)} onConfirm={() => { onChange('confirmed', true); setDialog(false); }} />}</Card>;
}

type EditOp = Record<string, unknown> & { id?: string; page?: number; kind?: string; points?: Array<{ x: number; y: number }> };
function operationRect(op: EditOp, index: number): Rect { return { id: String(op.id ?? `op-${index}`), page: Number(op.page ?? 1), x: Number(op.x ?? 72), y: Number(op.y ?? 72), width: Number(op.width ?? 180), height: Number(op.height ?? 48) }; }
export function EditSettings({ items, settings, onChange }: ToolSettingsProps) {
  const ops = readJson<EditOp[]>(settings.ops, []); const [mode, setMode] = useState('text'); const [page, setPage] = useState(1); const [history, setHistory] = useState<EditOp[][]>([]); const [future, setFuture] = useState<EditOp[][]>([]);
  const image = settings.imageFile instanceof File ? settings.imageFile : undefined; const [imageUrl, setImageUrl] = useState('');
  useEffect(() => { if (!image) { setImageUrl(''); return undefined; } const url = URL.createObjectURL(image); setImageUrl(url); return () => URL.revokeObjectURL(url); }, [image]);
  const rectOps = ops.map(operationRect).filter((_rect, index) => ops[index].kind !== 'draw');
  const paths: FreehandPath[] = ops.map((op, index) => ({ id: String(op.id ?? `path-${index}`), page: Number(op.page ?? 1), points: op.points ?? [], kind: op.kind })).filter((path) => path.kind === 'draw' && path.points.length > 0).map(({ kind: _kind, ...path }) => path);
  const commit = (next: EditOp[]) => { setHistory((stack) => [...stack, ops]); setFuture([]); onChange('ops', JSON.stringify(next)); };
  const updateRects = (next: Rect[]) => {
    const byId = new Map(next.map((rect) => [rect.id, rect]));
    const known = new Set(ops.map((op, index) => String(op.id ?? `op-${index}`)));
    const updated = ops.filter((op, index) => op.kind === 'draw' || byId.has(String(op.id ?? `op-${index}`))).map((op, index) => { const rect = byId.get(String(op.id ?? `op-${index}`)); return rect ? { ...op, ...rect } : op; });
    const additions = next.filter((rect) => !known.has(rect.id)).map((rect) => ({
      ...rect,
      id: rect.id,
      kind: mode === 'highlight' ? 'highlight' : mode === 'ellipse' ? 'ellipse' : mode === 'rectangle' ? 'rect' : mode === 'image' ? 'image' : 'text',
      text: String(settings.text ?? 'Edited text'),
      color: String(settings.color ?? '#111827'),
      strokeWidth: Number(settings.strokeWidth ?? 2),
      fontSize: Number(settings.fontSize ?? 18),
    }));
    commit([...updated, ...additions]);
  };
  const updatePaths = (next: FreehandPath[]) => {
    const byId = new Map(next.map((path) => [path.id, path]));
    const known = new Set(ops.map((op, index) => String(op.id ?? `path-${index}`)));
    const updated = ops.filter((op, index) => op.kind !== 'draw' || byId.has(String(op.id ?? `path-${index}`))).map((op, index) => { const path = byId.get(String(op.id ?? `path-${index}`)); return path ? { ...op, points: path.points } : op; });
    const additions = next.filter((path) => !known.has(path.id)).map((path) => ({ id: path.id, page: path.page, kind: 'draw', points: path.points, color: String(settings.color ?? '#111827'), strokeWidth: Number(settings.strokeWidth ?? 2) }));
    commit([...updated, ...additions]);
  };
  const undo = () => { const previous = history.at(-1); if (!previous) return; setHistory((stack) => stack.slice(0, -1)); setFuture((stack) => [ops, ...stack]); onChange('ops', JSON.stringify(previous)); };
  const redo = () => { const next = future[0]; if (!next) return; setFuture((stack) => stack.slice(1)); setHistory((stack) => [...stack, ops]); onChange('ops', JSON.stringify(next)); };
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (!(event.ctrlKey || event.metaKey)) return; if (event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); } if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); });
  return <Card className="mt-6 space-y-4"><p className="text-sm text-secondary">Select a tool, then drag directly on the rendered page. Existing text cannot be reflowed; text edits cover and re-add content.</p><div className="flex flex-wrap gap-2" aria-label="Edit tools">{['select', 'text', 'freehand', 'highlight', 'rectangle', 'ellipse', 'image'].map((tool) => <button key={tool} type="button" className={`rounded border px-3 py-2 text-sm capitalize ${mode === tool ? 'border-accent bg-accent/10' : 'border-subtle'}`} onClick={() => setMode(tool)}>{tool}</button>)}</div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Text<input className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" value={String(settings.text ?? 'Edited text')} onChange={(event) => onChange('text', event.target.value)} /></label><label className="text-sm font-semibold">Color<input className="mt-2 h-10 w-full rounded border border-subtle bg-surface p-1" type="color" value={String(settings.color ?? '#111827')} onChange={(event) => onChange('color', event.target.value)} /></label></div>{mode === 'image' && <label className="text-sm font-semibold">Image for operation<input className="mt-2 block text-sm font-normal" type="file" accept="image/png,image/jpeg" onChange={(event) => onChange('imageFile', event.target.files?.[0] as File)} /></label>}{items[0] && <PageOverlay file={items[0].file} page={page} onPageChange={setPage} rects={rectOps} onRectsChange={updateRects} mode={mode === 'freehand' ? 'freehand' : mode === 'select' ? 'move' : 'draw-rect'} paths={paths} onPathsChange={updatePaths} renderRect={(rect) => { const op = ops.find((item, index) => String(item.id ?? `op-${index}`) === rect.id); const color = String(op?.color ?? settings.color ?? '#111827'); if (op?.kind === 'image') return imageUrl ? <img className="h-full w-full object-contain" src={imageUrl} alt="Edit image preview" /> : <span className="block p-1 text-[10px] text-muted">Choose an image</span>; if (op?.kind === 'text') return <span className="block truncate p-1 text-sm" style={{ color }}>{String(op.text ?? settings.text ?? 'Edited text')}</span>; if (op?.kind === 'highlight') return <span className="block h-full w-full" style={{ backgroundColor: color, opacity: 0.35 }} />; if (op?.kind === 'ellipse') return <span className="block h-full w-full rounded-[50%] border-2" style={{ borderColor: color }} />; if (op?.kind === 'rect') return <span className="block h-full w-full border-2" style={{ borderColor: color }} />; return null; }} /> }<div className="flex flex-wrap gap-2"><button type="button" className="rounded border border-subtle px-3 py-2 text-sm" onClick={undo} disabled={!history.length}>Undo</button><button type="button" className="rounded border border-subtle px-3 py-2 text-sm" onClick={redo} disabled={!future.length}>Redo</button><button type="button" className="rounded border border-subtle px-3 py-2 text-sm" onClick={() => commit([])}>Clear edits</button><span className="py-2 text-sm text-muted">{ops.length} operation{ops.length === 1 ? '' : 's'} queued</span></div></Card>;
}

interface FormField { name: string; type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'signature-placeholder'; value?: string | boolean; page: number; x: number; y: number; width: number; height: number; options?: string[] }
export function FormsSettings({ items, settings, onChange }: ToolSettingsProps) {
  const [fields, setFields] = useState<FormField[]>(() => readJson<FormField[]>(settings.detectedFields, [])); const [page, setPage] = useState(1); const [addType, setAddType] = useState<FormField['type']>(); const [selected, setSelected] = useState<string>();
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  useEffect(() => { const file = items[0]?.file; if (!file) return; const body = new FormData(); body.append('file', file); body.append('mode', 'detect'); void fetch('/api/pdf/forms', { method: 'POST', body }).then((response) => response.json() as Promise<{ fields?: FormField[] }>).then((result) => { if (result.fields) { setFields(result.fields); onChange('detectedFields', JSON.stringify(result.fields)); } }).catch(() => undefined); }, [items, onChange]);
  const values = fields.reduce<Record<string, string | boolean>>((result, field) => { result[field.name] = field.value ?? (field.type === 'checkbox' ? false : ''); return result; }, {});
  const setValue = (name: string, value: string | boolean) => { const next = fields.map((field) => field.name === name ? { ...field, value } : field); setFields(next); onChange('detectedFields', JSON.stringify(next)); onChange('values', JSON.stringify(next.reduce<Record<string, string | boolean>>((result, field) => { result[field.name] = field.value ?? ''; return result; }, {}))); };
  const fieldRects = fields.map((field) => ({ id: field.name, page: field.page, x: field.x, y: field.y, width: field.width, height: field.height }));
  const updateRects = (next: Rect[]) => {
    const current = fieldsRef.current;
    const known = new Set(current.map((field) => field.name));
    const updated = current.map((field) => { const rect = next.find((item) => item.id === field.name); return rect ? { ...field, page: rect.page, x: rect.x, y: rect.y, width: rect.width, height: rect.height } : field; });
    const added = next.filter((rect) => !known.has(rect.id)).map((rect) => ({ name: rect.id, type: addType ?? 'text', page: rect.page, x: rect.x, y: rect.y, width: rect.width, height: rect.height, ...(addType === 'dropdown' ? { options: ['Option 1', 'Option 2'] } : {}) }));
    const result = [...updated, ...added]; setFields(result); onChange('fields', JSON.stringify(result)); onChange('detectedFields', JSON.stringify(result)); setAddType(undefined);
  };
  return <Card className="mt-6 space-y-4"><p className="text-sm text-secondary">Detected fields are bound to real inputs below. Focus a field to review its page and rectangle. Choose an Add field type, then drag its rectangle directly on the page.</p>{items[0] && <PageOverlay file={items[0].file} page={page} onPageChange={setPage} rects={fieldRects} onRectsChange={updateRects} mode={addType ? 'draw-rect' : 'move'} selectedId={selected} onSelectedIdChange={setSelected} renderRect={(field) => <span className="block truncate p-1 text-[10px]">{fields.find((item) => item.name === field.id)?.name}</span>} />}{fields.map((field) => { const focus = () => { setSelected(field.name); setPage(field.page); }; return <div key={field.name} className={`rounded border p-3 text-sm ${selected === field.name ? 'border-accent bg-accent/5' : 'border-subtle'}`}><span className="font-semibold">{field.name}</span> <span className="text-xs text-muted">({field.type}, page {field.page})</span>{field.type === 'checkbox' ? <input className="ml-3" type="checkbox" checked={Boolean(values[field.name])} onFocus={focus} onChange={(event) => setValue(field.name, event.target.checked)} aria-label={field.name} /> : field.type === 'dropdown' ? <select className="mt-2 block w-full rounded border border-subtle bg-surface p-2" value={String(values[field.name] ?? '')} onFocus={focus} onChange={(event) => setValue(field.name, event.target.value)} aria-label={field.name}>{(field.options ?? []).map((option) => <option key={option}>{option}</option>)}</select> : field.type === 'radio' ? <span className="mt-2 flex flex-wrap gap-3" role="radiogroup" aria-label={field.name}>{(field.options ?? ['Option 1', 'Option 2']).map((option) => <label key={option} className="flex items-center gap-2"><input type="radio" name={field.name} value={option} checked={String(values[field.name] ?? '') === option} onFocus={focus} onChange={() => setValue(field.name, option)} />{option}</label>)}</span> : field.type === 'signature-placeholder' ? <button type="button" className="mt-2 block w-full rounded border border-dashed border-subtle p-2 text-left text-muted" onFocus={focus} onClick={focus}>Signature placeholder — signed later with Sign PDF</button> : <input className="mt-2 block w-full rounded border border-subtle bg-surface p-2" value={String(values[field.name] ?? '')} onFocus={focus} onChange={(event) => setValue(field.name, event.target.value)} aria-label={field.name} />}</div>; })}<div className="flex flex-wrap gap-2">{(['text', 'checkbox', 'radio', 'dropdown', 'signature-placeholder'] as const).map((type) => <button key={type} type="button" className={`rounded border px-3 py-2 text-sm capitalize ${addType === type ? 'border-accent bg-accent/10' : 'border-subtle'}`} onClick={() => setAddType(type)}>Add {type}</button>)}</div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(settings.flatten)} onChange={(event) => onChange('flatten', event.target.checked)} /> Flatten after filling</label></Card>;
}

export function MarkdownSettings({ items }: ToolSettingsProps) {
  const [markdown, setMarkdown] = useState(''); const [copied, setCopied] = useState(false);
  useEffect(() => { const file = items[0]?.result?.files.find((entry) => entry.name.endsWith('.md')); if (!file) return; void fetch(`${file.downloadUrl}?inline=1`).then((response) => response.text()).then(setMarkdown).catch(() => undefined); }, [items]);
  const preview = useMemo(() => markdown.split('\n').map((line, index) => line.startsWith('# ') ? <h2 key={index} className="mt-3 text-lg font-bold">{line.slice(2)}</h2> : line.startsWith('## ') ? <h3 key={index} className="mt-3 font-bold">{line.slice(3)}</h3> : line.startsWith('- ') ? <li key={index} className="ml-5 list-disc">{line.slice(2)}</li> : line.startsWith('|') ? <code key={index} className="block text-xs">{line}</code> : <p key={index} className="min-h-5">{line}</p>), [markdown]);
  return <Card className="mt-6 space-y-4"><p className="text-sm text-secondary">Generate Markdown, then edit the source or review the rendered preview. Copy and download are available here.</p><div className="grid gap-4 md:grid-cols-2"><textarea className="min-h-72 w-full rounded border border-subtle bg-surface p-3 font-mono text-sm" value={markdown} onChange={(event) => setMarkdown(event.target.value)} aria-label="Markdown source" /><div className="min-h-72 overflow-auto rounded border border-subtle bg-sunken p-3" aria-label="Rendered Markdown preview">{preview}</div></div><div className="flex gap-2"><button type="button" className="rounded border border-subtle px-3 py-2 text-sm" onClick={() => { void navigator.clipboard.writeText(markdown); setCopied(true); }}>Copy Markdown</button><button type="button" className="rounded border border-subtle px-3 py-2 text-sm" onClick={() => { const blob = new Blob([markdown], { type: 'text/markdown' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'document.md'; link.click(); URL.revokeObjectURL(url); }}>Download .md</button>{copied && <span className="py-2 text-sm text-accent">Copied</span>}</div></Card>;
}

export function AiSummarizerSettings({ settings, onChange }: ToolSettingsProps) {
  return <Card className="mt-6 space-y-4"><p className="text-sm text-secondary">AI summarization is ready when this deployment has AI_PROVIDER, AI_API_KEY, AI_BASE_URL, and AI_MODEL configured.</p><label className="text-sm font-semibold">Summary length<select className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" value={String(settings.length ?? 'medium')} onChange={(event) => onChange('length', event.target.value)}><option value="short">Short</option><option value="medium">Medium</option><option value="detailed">Detailed</option></select></label></Card>;
}

export function TranslateSettings({ settings, onChange }: ToolSettingsProps) {
  return <Card className="mt-6 space-y-4"><p className="text-sm text-secondary">AI translation is ready when this deployment has AI_PROVIDER, AI_API_KEY, AI_BASE_URL, and AI_MODEL configured.</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Source language<select className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" value={String(settings.sourceLanguage ?? 'auto')} onChange={(event) => onChange('sourceLanguage', event.target.value)}><option value="auto">Auto-detect</option><option>English</option><option>Spanish</option><option>French</option><option>German</option></select></label><label className="text-sm font-semibold">Target language<select className="mt-2 w-full rounded border border-subtle bg-surface p-2 font-normal" value={String(settings.targetLanguage ?? 'English')} onChange={(event) => onChange('targetLanguage', event.target.value)}><option>English</option><option>Spanish</option><option>French</option><option>German</option><option>Japanese</option></select></label></div></Card>;
}

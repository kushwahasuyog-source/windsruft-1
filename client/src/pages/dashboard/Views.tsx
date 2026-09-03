import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toolRegistry } from '@shared/tools';
import { Icon } from '../../components/icons';
import { Card, ThemeToggle } from '../../components/ui/Primitives';
import { getFavorites, getHistory, toggleFavorite } from '../../services/history';

function HistoryRows() {
  const entries = getHistory();
  if (!entries.length) return <p className="text-secondary">No local operations yet. Process a PDF to see it here.</p>;
  return <div className="space-y-3">{entries.map((entry) => { const expired = new Date(entry.expiresAt).getTime() < Date.now(); return <div key={entry.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-subtle p-3"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{entry.fileName}</p><p className="text-sm text-muted">{entry.tool} · {new Date(entry.date).toLocaleString()} · {entry.status}</p></div>{entry.downloadUrl && (expired ? <span className="text-sm text-muted">This file has expired.</span> : <a className="text-sm font-semibold text-accent underline" href={entry.downloadUrl}>Download</a>)}</div>; })}</div>;
}

export function DashboardHome() { return <Card><h2 className="font-display text-3xl font-black">Your workspace</h2><p className="mt-3 text-secondary">History is local to this browser. Uploaded files are temporary and expire after processing.</p><div className="mt-7"><h3 className="mb-4 font-bold">Recent operations</h3><HistoryRows /></div></Card>; }
export function MyFiles() { return <Card><h2 className="font-display text-3xl font-black">My Files</h2><p className="mb-6 mt-3 text-secondary">Files remain available only while their temporary server workspace is alive.</p><HistoryRows /></Card>; }
export function RecentFiles() { return <Card><h2 className="font-display text-3xl font-black">Recent Files</h2><p className="mb-6 mt-3 text-secondary">Your recent activity is stored locally in this browser.</p><HistoryRows /></Card>; }
export function Favorites() {
  const [favorites, setFavorites] = useState(getFavorites());
  return <Card><h2 className="font-display text-3xl font-black">Favorites</h2><p className="mb-6 mt-3 text-secondary">Star the tools you use most.</p><div className="grid gap-3 sm:grid-cols-2">{toolRegistry.filter((tool) => favorites.includes(tool.slug)).map((tool) => <div key={tool.slug} className="flex items-center gap-3 rounded-xl border border-subtle p-3"><Icon name={tool.icon} className="h-6 w-6 text-accent" /><Link className="min-w-0 flex-1 font-semibold" to={tool.path}>{tool.name}</Link><button aria-label={`Remove ${tool.name} from favorites`} onClick={() => setFavorites(toggleFavorite(tool.slug))}>★</button></div>)}{!favorites.length && <p className="text-secondary">No favorites yet. Add them from the tools directory.</p>}</div></Card>;
}
export function Settings() {
  const [level, setLevel] = useState(localStorage.getItem('pdfforge-default-level') ?? 'recommended');
  const update = (value: string) => { setLevel(value); localStorage.setItem('pdfforge-default-level', value); };
  return <Card><h2 className="font-display text-3xl font-black">Settings</h2><div className="mt-7 space-y-6"><label className="block font-semibold">Theme<div className="mt-2"><ThemeToggle /></div></label><label className="block font-semibold">Default compression level<select className="mt-2 block rounded-lg border border-subtle bg-surface px-3 py-2 font-normal" value={level} onChange={(event) => update(event.target.value)}><option value="low">Low</option><option value="recommended">Recommended</option><option value="high">High</option></select></label><p className="text-sm text-muted">History is stored locally; server files are temporary and automatically deleted.</p></div></Card>;
}

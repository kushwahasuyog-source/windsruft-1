import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { categories, toolRegistry } from '@shared/tools';
import { Icon } from '../components/icons';
import { Card } from '../components/ui/Primitives';
import { getFavorites, toggleFavorite } from '../services/history';

export function Tools() {
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState(getFavorites());
  const filtered = useMemo(() => toolRegistry.filter((tool) => `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <main className="mx-auto max-w-shell px-gutter py-section"><h1 className="font-display text-4xl font-black">All PDF Tools</h1><input className="mt-7 w-full rounded-lg border border-subtle bg-elevated px-4 py-3 outline-none focus:border-accent" aria-label="Search PDF tools" placeholder="Search PDF tools..." value={query} onChange={(event) => setQuery(event.target.value)} /><div className="mt-10 space-y-12">{categories.map((category) => { const tools = filtered.filter((tool) => tool.category === category); return tools.length ? <section key={category}><h2 className="mb-5 text-xs font-bold tracking-widest text-muted">{category}</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{tools.map((tool) => <Link to={tool.path} key={tool.slug}><Card className="relative h-full transition hover:border-accent"><button className="absolute right-4 top-4 text-lg text-accent" aria-label={`${favorites.includes(tool.slug) ? 'Remove' : 'Add'} ${tool.name} ${favorites.includes(tool.slug) ? 'from' : 'to'} favorites`} onClick={(event) => { event.preventDefault(); setFavorites(toggleFavorite(tool.slug)); }}>{favorites.includes(tool.slug) ? '★' : '☆'}</button><Icon name={tool.icon} className="mb-4 h-7 w-7 text-accent" /><h3 className="font-bold">{tool.name}</h3><p className="mt-2 text-sm text-secondary">{tool.description}</p>{tool.status === 'planned' && <span className="mt-3 inline-block text-xs text-muted">Coming soon</span>}</Card></Link>)}</div></section> : null; })}</div></main>;
}

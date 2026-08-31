import { NavLink, Outlet } from 'react-router-dom';
import { Card } from '../../components/ui/Primitives';

const links = [['', 'Dashboard'], ['files', 'My Files'], ['recent', 'Recent Files'], ['favorites', 'Favorites'], ['settings', 'Settings']];

export function DashboardLayout() {
  return <main className="mx-auto grid max-w-shell gap-6 px-gutter py-section lg:grid-cols-[220px_1fr]"><aside><Card className="p-3"><h1 className="px-3 py-3 font-display text-xl font-black">Workspace</h1><nav className="space-y-1" aria-label="Workspace navigation">{links.map(([path, label]) => <NavLink key={path} end={!path} to={path} className={({ isActive }) => `block min-h-touch rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-accent text-on-accent' : 'hover:bg-accent-soft hover:text-accent'}`}>{label}</NavLink>)}</nav></Card></aside><section><Outlet /></section></main>;
}

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { categories, toolRegistry } from '@shared/tools';
import { Icon } from './icons';
import { Brand, Button, ThemeToggle } from './ui/Primitives';

const convertCategories = ['CONVERT TO PDF', 'CONVERT FROM PDF'] as const;

function MenuLinks({ category, close }: { category: string; close: () => void }) {
  const links = toolRegistry.filter((tool) => tool.category === category);
  const refs = useRef<Array<HTMLAnchorElement | null>>([]);
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = refs.current.findIndex((item) => item === document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + links.length) % links.length;
    refs.current[next]?.focus();
  };
  return (
    <div onKeyDown={onKeyDown}>
      {links.map((tool, index) => (
        <Link ref={(element) => { refs.current[index] = element; }} className="flex min-h-touch items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-accent-soft hover:text-accent" key={tool.slug} to={tool.path} onClick={close}>
          <Icon name={tool.icon} className="h-4 w-4 shrink-0" />{tool.name}{tool.status === 'planned' && <span className="ml-auto text-xs text-muted">Soon</span>}
        </Link>
      ))}
    </div>
  );
}

export function Header() {
  const [desktopMenu, setDesktopMenu] = useState<'all' | 'convert' | 'launcher'>();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCategory, setMobileCategory] = useState<string>();
  const allTrigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setDesktopMenu(undefined);
        setMobileOpen(false);
      }
    };
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDesktopMenu(undefined);
        setMobileOpen(false);
        allTrigger.current?.focus();
      }
    };
    document.addEventListener('click', onOutside);
    document.addEventListener('keydown', onEscape);
    return () => { document.removeEventListener('click', onOutside); document.removeEventListener('keydown', onEscape); };
  }, []);
  const close = () => { setDesktopMenu(undefined); setMobileOpen(false); };
  return (
    <header ref={root} className="sticky top-0 z-40 border-b border-subtle bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-gutter py-4">
        <Link to="/" aria-label="PDFForge home" onClick={close}><Brand /></Link>
        <nav className="hidden items-center gap-4 text-sm font-semibold lg:flex" aria-label="Primary navigation">
          <Link to="/tool/merge-pdf">Merge PDF</Link><Link to="/tool/split-pdf">Split PDF</Link><Link to="/tool/compress-pdf">Compress PDF</Link>
          <div className="relative">
            <button type="button" className="min-h-touch" aria-expanded={desktopMenu === 'convert'} aria-controls="convert-menu" onClick={() => setDesktopMenu(desktopMenu === 'convert' ? undefined : 'convert')}>Convert PDF⌄</button>
            {desktopMenu === 'convert' && <div id="convert-menu" className="absolute right-0 mt-3 grid w-96 grid-cols-2 gap-4 rounded-2xl border border-subtle bg-elevated p-4 shadow-pop">{convertCategories.map((category) => <div key={category}><h2 className="mb-2 text-xs font-bold tracking-widest text-muted">{category}</h2><MenuLinks category={category} close={close} /></div>)}</div>}
          </div>
          <button ref={allTrigger} type="button" className="min-h-touch" aria-expanded={desktopMenu === 'all'} aria-controls="all-tools-menu" onClick={() => setDesktopMenu(desktopMenu === 'all' ? undefined : 'all')}>All PDF Tools⌄</button>
          <div className="relative">
            <button type="button" className="flex min-h-touch min-w-touch items-center justify-center rounded-lg border border-subtle" aria-label="Open app launcher" aria-expanded={desktopMenu === 'launcher'} aria-controls="launcher-menu" onClick={() => setDesktopMenu(desktopMenu === 'launcher' ? undefined : 'launcher')}><span aria-hidden="true">▦</span></button>
            {desktopMenu === 'launcher' && <div id="launcher-menu" className="absolute right-0 mt-3 w-72 rounded-2xl border border-subtle bg-elevated p-3 shadow-pop"><div className="grid grid-cols-3 gap-2">{toolRegistry.map((tool) => <Link key={tool.slug} to={tool.path} onClick={close} className="rounded-lg p-2 text-center text-xs hover:bg-accent-soft hover:text-accent"><Icon name={tool.icon} className="mx-auto mb-1 h-5 w-5" />{tool.name}</Link>)}</div></div>}
          </div>
        </nav>
        <div className="hidden items-center gap-3 sm:flex"><ThemeToggle /><Link to="/login">Login</Link><Link className="rounded-lg bg-accent px-4 py-2 text-on-accent" to="/signup">Sign Up</Link></div>
        <Button className="border border-subtle lg:hidden" type="button" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="mobile-drawer" onClick={() => setMobileOpen((value) => !value)}>☰</Button>
      </div>
      {desktopMenu === 'all' && <div id="all-tools-menu" className="absolute left-0 right-0 max-h-[80vh] overflow-y-auto border-b border-subtle bg-surface p-6 shadow-pop"><div className="mx-auto grid max-w-shell gap-6 sm:grid-cols-2 lg:grid-cols-4">{categories.map((category) => <div key={category}><h2 className="mb-3 text-xs font-bold tracking-widest text-muted">{category}</h2><MenuLinks category={category} close={close} /></div>)}</div></div>}
      {mobileOpen && <aside id="mobile-drawer" className="absolute left-0 right-0 max-h-[calc(100vh-5rem)] overflow-y-auto border-b border-subtle bg-surface p-4 shadow-pop lg:hidden"><div className="flex items-center justify-between border-b border-subtle pb-3"><ThemeToggle /><div className="flex gap-3"><Link to="/login" onClick={close}>Login</Link><Link to="/signup" onClick={close}>Sign Up</Link></div></div>{categories.map((category) => <div key={category} className="border-b border-subtle"><button className="flex min-h-touch w-full items-center justify-between text-left font-semibold" aria-expanded={mobileCategory === category} onClick={() => setMobileCategory(mobileCategory === category ? undefined : category)}>{category}<span>{mobileCategory === category ? '−' : '+'}</span></button>{mobileCategory === category && <div className="pb-2"><MenuLinks category={category} close={close} /></div>}</div>)}</aside>}
    </header>
  );
}

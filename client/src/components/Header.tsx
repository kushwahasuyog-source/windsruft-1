import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { categories, toolRegistry } from '@shared/tools';
import { Brand, ThemeToggle } from './ui/Primitives';

export function Header() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('[data-menu-root]')) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('click', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('click', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);
  return (
    <header className="sticky top-0 z-40 border-b border-subtle bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-gutter py-4">
        <Link to="/" aria-label="PDFForge home"><Brand /></Link>
        <nav className="hidden items-center gap-5 text-sm font-semibold lg:flex" aria-label="Primary navigation">
          <Link to="/tool/merge-pdf">Merge PDF</Link>
          <Link to="/tool/split-pdf">Split PDF</Link>
          <Link to="/tool/compress-pdf">Compress PDF</Link>
          <button
            ref={trigger}
            data-menu-root
            type="button"
            aria-expanded={open}
            aria-controls="mega-menu"
            onClick={() => setOpen((current) => !current)}
          >
            All PDF Tools <span aria-hidden="true">⌄</span>
          </button>
        </nav>
        <div className="hidden items-center gap-3 sm:flex">
          <ThemeToggle />
          <Link to="/login">Login</Link>
          <Link className="rounded-lg bg-accent px-4 py-2 text-on-accent" to="/signup">Sign Up</Link>
        </div>
        <button className="min-h-touch min-w-touch text-2xl lg:hidden" type="button" aria-label="Open navigation" onClick={() => setOpen((current) => !current)}>☰</button>
      </div>
      {open && (
        <div id="mega-menu" data-menu-root className="absolute left-0 right-0 max-h-[80vh] overflow-y-auto border-b border-subtle bg-surface p-6 shadow-pop">
          <div className="mx-auto grid max-w-shell gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <div key={category}>
                <h2 className="mb-3 text-xs font-bold tracking-widest text-muted">{category}</h2>
                <div className="space-y-2">
                  {toolRegistry.filter((tool) => tool.category === category).map((tool) => (
                    <Link className="block py-1 text-sm hover:text-accent" key={tool.slug} to={tool.path} onClick={() => setOpen(false)}>
                      {tool.name}
                      {tool.status === 'planned' && <span className="ml-2 text-xs text-muted">Soon</span>}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

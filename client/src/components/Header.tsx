import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { categories, toolRegistry } from '@shared/tools';
import { Icon } from './icons';
import { Brand, ThemeToggle } from './ui/Primitives';

function MenuLinks({ category, close }: { category: string; close: () => void }) {
  const links = toolRegistry.filter((tool) => tool.category === category);
  const refs = useRef<Array<HTMLAnchorElement | null>>([]);
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const index = refs.current.findIndex((item) => item === document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + links.length) % links.length;
    refs.current[next]?.focus();
  };
  return <div onKeyDown={onKeyDown}>{links.map((tool,index) => <Link ref={(el)=>{refs.current[index]=el}} className="flex min-h-touch items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent-soft hover:text-accent" key={tool.slug} to={tool.path} onClick={close}><Icon name={tool.icon} className="h-4 w-4 shrink-0"/>{tool.name}{tool.status==='planned'&&<span className="ml-auto text-xs text-muted">Soon</span>}</Link>)}</div>;
}

export function Header() {
  const [menu, setMenu] = useState<'all'|'convert'|'launcher'>();
  const [mobileOpen,setMobileOpen]=useState(false);
  const [mobileCategory,setMobileCategory]=useState<string>();
  const root=useRef<HTMLElement>(null);
  useEffect(()=>{
    const outside=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node)){setMenu(undefined);setMobileOpen(false);}};
    const escape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'){setMenu(undefined);setMobileOpen(false);}};
    document.addEventListener('click',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('click',outside);document.removeEventListener('keydown',escape)};
  },[]);
  const close=()=>{setMenu(undefined);setMobileOpen(false)};
  return <header ref={root} className="sticky top-0 z-40 border-b border-subtle bg-surface/85 backdrop-blur-xl">
    <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-gutter py-3.5">
      <Link to="/" onClick={close}><Brand/></Link>
      <nav className="hidden items-center gap-1 text-sm font-semibold lg:flex">
        <Link className="nav-link" to="/tool/compress-pdf">Compress</Link>
        <Link className="nav-link" to="/tool/merge-pdf">Merge</Link>
        <Link className="nav-link" to="/tool/split-pdf">Split</Link>
        <Link className="nav-link" to="/tools">All tools</Link>
        <button className="nav-link" type="button" aria-expanded={menu==='all'} onClick={()=>setMenu(menu==='all'?undefined:'all')}>Categories⌄</button>
        {menu==='all'&&<div className="absolute left-0 right-0 top-full border-b border-subtle bg-surface shadow-pop"><div className="mx-auto grid max-h-[70vh] max-w-shell gap-6 overflow-y-auto p-6 sm:grid-cols-2 lg:grid-cols-4">{categories.map(category=><div key={category}><h2 className="mb-2 text-xs font-bold tracking-widest text-muted">{category}</h2><MenuLinks category={category} close={close}/></div>)}</div></div>}
      </nav>
      <div className="hidden items-center gap-3 sm:flex"><ThemeToggle/><Link className="rounded-lg px-3 py-2 text-sm font-semibold" to="/login">Log in</Link><Link className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-on-accent shadow-soft" to="/signup">Get started</Link></div>
      <button className="rounded-lg border border-subtle px-3 py-2 lg:hidden" type="button" aria-label="Open navigation" onClick={()=>setMobileOpen(v=>!v)}>☰</button>
    </div>
    {mobileOpen&&<aside className="absolute left-0 right-0 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-subtle bg-surface p-4 shadow-pop lg:hidden"><div className="mb-2 flex justify-between border-b border-subtle pb-3"><ThemeToggle/><div className="flex gap-3 text-sm"><Link to="/login" onClick={close}>Log in</Link><Link to="/signup" onClick={close}>Get started</Link></div></div>{categories.map(category=><div key={category} className="border-b border-subtle"><button className="flex min-h-touch w-full items-center justify-between text-left font-semibold" onClick={()=>setMobileCategory(mobileCategory===category?undefined:category)}>{category}<span>{mobileCategory===category?'−':'+'}</span></button>{mobileCategory===category&&<div className="pb-2"><MenuLinks category={category} close={close}/></div>}</div>)}</aside>}
  </header>;
}

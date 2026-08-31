import { useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { categories, getTool, toolRegistry } from '@shared/tools';
import { ToolPageLayout } from '../components/ToolPageLayout';
import { Button, Card } from '../components/ui/Primitives';

export function Home() {
  const navigate = useNavigate();
  const picker = useRef<HTMLInputElement>(null);
  const popular = ['compress-pdf', 'merge-pdf', 'split-pdf', 'pdf-to-word', 'pdf-to-jpg', 'jpg-to-pdf', 'protect-pdf', 'sign-pdf'];
  return (
    <main>
      <section className="mx-auto max-w-shell px-gutter py-24 text-center sm:py-32">
        <p className="mb-4 text-sm font-bold uppercase tracking-widest text-accent">Everything you need to work with PDFs</p>
        <h1 className="font-display text-5xl font-black tracking-tight sm:text-7xl">Powerful PDF Tools.<br /><span className="text-accent">One Simple Workspace.</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-secondary">Compress, convert, edit, organize, secure and manage your PDF files in one place.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button className="bg-accent text-on-accent" onClick={() => picker.current?.click()}>Choose a PDF</Button>
          <input
            ref={picker}
            hidden
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) navigate('/tool/compress-pdf', { state: { file } });
            }}
          />
          <Link className="rounded-lg border border-subtle px-4 py-2 font-semibold" to="/tools">Explore PDF Tools</Link>
        </div>
      </section>
      <section className="mx-auto max-w-shell px-gutter pb-20">
        <h2 className="mb-6 font-display text-2xl font-black">Popular tools</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {popular.map((slug) => {
            const tool = getTool(slug);
            if (!tool) return null;
            return <Link key={slug} to={tool.path}><Card className="h-full transition hover:-translate-y-1 hover:border-accent"><div className="mb-4 text-2xl text-accent">◈</div><h3 className="font-bold">{tool.name}</h3><p className="mt-2 text-sm text-secondary">{tool.description}</p></Card></Link>;
          })}
        </div>
      </section>
    </main>
  );
}

export function Tools() {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => toolRegistry.filter((tool) =>
    `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(query.toLowerCase()),
  ), [query]);
  return (
    <main className="mx-auto max-w-shell px-gutter py-section">
      <h1 className="font-display text-4xl font-black">All PDF Tools</h1>
      <input className="mt-7 w-full rounded-lg border border-subtle bg-elevated px-4 py-3 outline-none focus:border-accent" aria-label="Search PDF tools" placeholder="Search PDF tools..." value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="mt-10 space-y-12">
        {categories.map((category) => {
          const tools = filtered.filter((tool) => tool.category === category);
          if (!tools.length) return null;
          return <section key={category}><h2 className="mb-5 text-xs font-bold tracking-widest text-muted">{category}</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{tools.map((tool) => <Link to={tool.path} key={tool.slug}><Card className="h-full transition hover:border-accent"><h3 className="font-bold">{tool.name}</h3><p className="mt-2 text-sm text-secondary">{tool.description}</p>{tool.status === 'planned' && <span className="mt-3 inline-block text-xs text-muted">Coming soon</span>}</Card></Link>)}</div></section>;
        })}
      </div>
    </main>
  );
}

export function Tool() {
  const { slug } = useParams();
  const location = useLocation();
  const tool = getTool(slug ?? '');
  if (!tool) return <NotFound />;
  return (
    <ToolPageLayout tool={tool} initialFile={location.state?.file}>
      {tool.slug === 'compress-pdf' && <p className="mt-3 text-center text-sm text-muted">Recommended balances quality and size for everyday sharing.</p>}
      {tool.slug === 'split-pdf' && <Card className="mt-6"><p className="font-semibold">Split mode</p><p className="mt-2 text-sm text-secondary">Every page, custom ranges, and extracted page lists are supported.</p></Card>}
      {tool.slug === 'rotate-pdf' && <Card className="mt-6"><p className="font-semibold">Rotation</p><p className="mt-2 text-sm text-secondary">Choose all pages or a comma-separated page list; rotate by 90°, 180°, or 270°.</p></Card>}
    </ToolPageLayout>
  );
}

export function Auth({ signup = false }: { signup?: boolean }) {
  return <main className="mx-auto max-w-md px-gutter py-20"><Card><h1 className="font-display text-3xl font-black">{signup ? 'Create your account' : 'Welcome back'}</h1><form className="mt-7 space-y-4" onSubmit={(event) => event.preventDefault()}><input required className="w-full rounded-lg border border-subtle bg-surface px-4 py-3" placeholder="Email" type="email" /><input required minLength={8} className="w-full rounded-lg border border-subtle bg-surface px-4 py-3" placeholder="Password (8+ characters)" type="password" /><Button className="w-full bg-accent text-on-accent">{signup ? 'Sign Up' : 'Login'}</Button><Button type="button" className="w-full border border-subtle">Continue with Google</Button></form></Card></main>;
}

export function Dashboard() {
  return <main className="mx-auto max-w-shell px-gutter py-section"><h1 className="font-display text-4xl font-black">Your workspace</h1><div className="mt-8 grid gap-4 sm:grid-cols-2"><Card><h2 className="text-xl font-bold">Recent files</h2><p className="mt-3 text-secondary">History is stored locally in this browser.</p></Card><Card><h2 className="text-xl font-bold">My Files</h2><p className="mt-3 text-secondary">Temporary files expire automatically.</p></Card></div></main>;
}

export function NotFound() {
  return <main className="mx-auto max-w-3xl px-gutter py-28 text-center"><h1 className="font-display text-6xl font-black">404</h1><p className="mt-4 text-secondary">That page does not exist.</p><Link className="mt-6 inline-block text-accent underline" to="/">Back home</Link></main>;
}

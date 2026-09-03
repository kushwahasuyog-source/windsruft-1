import { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTool } from '@shared/tools';
import { Icon } from '../components/icons';
import { Button, Card } from '../components/ui/Primitives';

const popular = ['compress-pdf', 'merge-pdf', 'split-pdf', 'pdf-to-word', 'pdf-to-jpg', 'jpg-to-pdf', 'protect-pdf', 'sign-pdf'];

export function Home() {
  const navigate = useNavigate();
  const picker = useRef<HTMLInputElement>(null);
  return (
    <main>
      <section className="mx-auto max-w-shell px-gutter py-24 text-center sm:py-32">
        <p className="mb-4 text-sm font-bold uppercase tracking-widest text-accent">Everything you need to work with PDFs</p>
        <h1 className="font-display text-5xl font-black tracking-tight sm:text-7xl">Powerful PDF Tools.<br /><span className="text-accent">One Simple Workspace.</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-secondary">Compress, convert, edit, organize, secure and manage your PDF files in one place.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button className="bg-accent text-on-accent" onClick={() => picker.current?.click()}>Choose a PDF</Button>
          <input ref={picker} hidden type="file" accept=".pdf,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) navigate('/tool/compress-pdf', { state: { file } }); }} />
          <Link className="rounded-lg border border-subtle px-4 py-2 font-semibold" to="/tools">Explore PDF Tools</Link>
        </div>
      </section>
      <section className="mx-auto max-w-shell px-gutter pb-20"><h2 className="mb-6 font-display text-2xl font-black">Popular tools</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{popular.map((slug) => { const tool = getTool(slug); return tool ? <Link key={slug} to={tool.path}><Card className="h-full transition hover:-translate-y-1 hover:border-accent"><Icon name={tool.icon} className="mb-4 h-8 w-8 text-accent" /><h3 className="font-bold">{tool.name}</h3><p className="mt-2 text-sm text-secondary">{tool.description}</p></Card></Link> : null; })}</div></section>
    </main>
  );
}

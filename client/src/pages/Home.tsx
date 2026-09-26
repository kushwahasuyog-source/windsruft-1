import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTool } from '@shared/tools';
import { Icon } from '../components/icons';
import { Button, Card } from '../components/ui/Primitives';

const popular = ['compress-pdf', 'merge-pdf', 'split-pdf', 'pdf-to-word', 'pdf-to-jpg', 'jpg-to-pdf', 'protect-pdf', 'sign-pdf'];

export function Home() {
  const navigate = useNavigate();
  const picker = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const matches = query.trim() ? popular.map((slug) => getTool(slug)).filter((tool) => tool?.name.toLowerCase().includes(query.toLowerCase())) : [];

  return (
    <main>
      <section className="hero-shell">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="mx-auto max-w-shell px-gutter py-16 text-center sm:py-24">
          <div className="hero-badge"><span className="status-dot" /> Fast, private PDF tools</div>
          <h1 className="hero-title">Your PDF tools.<br /><span>Simple, fast, online.</span></h1>
          <p className="hero-copy">Compress, convert, merge, split and edit PDFs without complicated software.</p>

          <div className="quick-action">
            <button className="drop-zone" onClick={() => picker.current?.click()} type="button">
              <span className="drop-icon"><Icon name="upload" className="h-6 w-6" /></span>
              <span className="drop-copy"><strong>Choose a PDF</strong><small>or drag & drop your file here</small></span>
              <span className="drop-arrow">→</span>
            </button>
            <input ref={picker} hidden type="file" accept=".pdf,application/pdf" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) navigate('/tool/compress-pdf', { state: { file } });
            }} />
            <p className="privacy-note">No registration required · Files are automatically deleted after processing</p>
          </div>

          <div className="search-wrap">
            <div className="search-box">
              <span className="text-muted">⌕</span>
              <input value={query} onFocus={() => setSearchOpen(true)} onChange={(e) => setQuery(e.target.value)} placeholder="Search a PDF tool..." aria-label="Search PDF tools" />
            </div>
            {searchOpen && query && (
              <div className="search-results">
                {matches.length ? matches.map((tool) => tool && <Link key={tool.slug} to={tool.path} onClick={() => setSearchOpen(false)}><Icon name={tool.icon} className="h-5 w-5 text-accent" /><span><b>{tool.name}</b><small>{tool.description}</small></span><span>→</span></Link>) : <p>No matching tool found.</p>}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-shell px-gutter py-16">
        <div className="section-heading"><div><p className="eyebrow">Most used</p><h2>Popular PDF tools</h2></div><Link to="/tools" className="text-link">View all tools →</Link></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {popular.map((slug) => {
            const tool = getTool(slug);
            return tool ? <Link key={slug} to={tool.path}><Card className="tool-card h-full"><span className="tool-icon"><Icon name={tool.icon} className="h-6 w-6" /></span><h3>{tool.name}</h3><p>{tool.description}</p><span className="tool-cta">Open tool →</span></Card></Link> : null;
          })}
        </div>
      </section>

      <section className="feature-band">
        <div className="mx-auto grid max-w-shell gap-6 px-gutter py-14 md:grid-cols-3">
          <div><span className="feature-number">01</span><h3>Fast processing</h3><p>Start working immediately with a lightweight interface built around one clear action.</p></div>
          <div><span className="feature-number">02</span><h3>Privacy first</h3><p>Your uploaded files are temporary and automatically removed after processing.</p></div>
          <div><span className="feature-number">03</span><h3>Works everywhere</h3><p>Use the same tools on desktop, tablet or mobile without installing an app.</p></div>
        </div>
      </section>

      <section className="mx-auto max-w-shell px-gutter py-16 text-center">
        <p className="eyebrow">One workspace</p>
        <h2 className="text-3xl font-black sm:text-4xl">Everything you need for PDFs.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-secondary">Explore the full toolkit for organizing, converting, editing, securing and understanding documents.</p>
        <Link className="mt-7 inline-flex rounded-xl bg-accent px-6 py-3 font-bold text-on-accent shadow-soft transition hover:-translate-y-0.5" to="/tools">Explore all PDF tools</Link>
      </section>
    </main>
  );
}

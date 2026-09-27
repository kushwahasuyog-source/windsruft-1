import type { ReactNode } from 'react';

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-gutter py-16">
      <article className="prose max-w-none dark:prose-invert">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">PDFForge legal</p>
        <h1 className="mt-3 font-display text-4xl font-black">{title}</h1>
        <p className="text-sm text-muted">Last updated: 27 September 2026</p>
        {children}
        <aside className="mt-10 rounded-xl border border-warning/30 bg-accent-soft p-4 text-sm text-secondary">
          <strong>Owner details still required:</strong> before production launch, replace the pending site-operator, contact, address, registration and governing-law details with your actual information and have the final legal text reviewed for the jurisdictions you serve.
        </aside>
      </article>
    </main>
  );
}

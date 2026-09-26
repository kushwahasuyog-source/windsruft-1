import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

export function Button({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return <button className={`min-h-touch rounded-xl px-4 py-2.5 font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props}>{children}</button>;
}

export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <section className={`rounded-2xl border border-subtle bg-elevated p-6 shadow-soft ${className}`} {...props}>{children}</section>;
}

export function Spinner() {
  return <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-label="Loading" />;
}

export function Brand() {
  return <span className="flex items-center gap-2.5 font-display text-xl font-black tracking-tight">
    <span className="brand-mark" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M5 2.75h9.5L19 7.2v14H5z" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M14.5 2.75V7.5H19M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></span>
    PDFForge
  </span>;
}

export function ThemeToggle() {
  const updateTheme = (theme: string) => {
    localStorage.setItem('pdfforge-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
  };
  return <select aria-label="Colour theme" defaultValue={localStorage.getItem('pdfforge-theme') ?? 'system'} onChange={(event) => updateTheme(event.target.value)} className="rounded-lg border border-subtle bg-surface px-2 py-1.5 text-sm">
    <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
  </select>;
}

export function Toast({ message, onClose }: { message: string; onClose?: () => void }) {
  return <div role="alert" className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl bg-primary px-4 py-3 text-on-accent shadow-pop">{message}{onClose && <button aria-label="Close notification" onClick={onClose}>×</button>}</div>;
}

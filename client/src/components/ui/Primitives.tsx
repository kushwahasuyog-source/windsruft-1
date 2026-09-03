import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

export function Button({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={`min-h-touch rounded-lg px-4 py-2 font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-subtle bg-elevated p-6 shadow-card ${className}`} {...props}>
      {children}
    </section>
  );
}

export function Spinner() {
  return <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-label="Loading" />;
}

export function Brand() {
  return (
    <span className="flex items-center gap-2 font-display text-xl font-black tracking-tight">
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <path d="M5 3.5h14l6 6v17H5z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M19 3.5v7h6M9 16h12M9 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="m4 9 5-5" stroke="rgb(var(--color-accent))" strokeWidth="3" strokeLinecap="round" />
      </svg>
      PDFForge
    </span>
  );
}

export function ThemeToggle() {
  const updateTheme = (theme: string) => {
    localStorage.setItem('pdfforge-theme', theme);
    document.documentElement.classList.toggle(
      'dark',
      theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
    );
  };
  return (
    <select
      aria-label="Colour theme"
      defaultValue={localStorage.getItem('pdfforge-theme') ?? 'system'}
      onChange={(event) => updateTheme(event.target.value)}
      className="rounded-md border border-subtle bg-surface px-2 py-1 text-sm"
    >
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  );
}

export function Toast({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <div role="alert" className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-lg bg-primary px-4 py-3 text-on-accent shadow-pop">
      {message}
      {onClose && <button aria-label="Close notification" onClick={onClose}>×</button>}
    </div>
  );
}

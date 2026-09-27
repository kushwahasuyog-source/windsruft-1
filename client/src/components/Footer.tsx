import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-subtle bg-sunken">
      <div className="mx-auto flex max-w-shell flex-col gap-4 px-gutter py-8 text-sm text-secondary sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} PDFForge. Site operator details are pending publication.</p>
        <nav aria-label="Legal and policy links" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link className="underline underline-offset-2" to="/privacy">Privacy Policy</Link>
          <Link className="underline underline-offset-2" to="/terms">Terms &amp; Conditions</Link>
          <Link className="underline underline-offset-2" to="/cookies">Cookies Policy</Link>
          <Link className="underline underline-offset-2" to="/refunds">Refund Policy</Link>
        </nav>
      </div>
    </footer>
  );
}

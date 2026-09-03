import { Link } from 'react-router-dom';

export function NotFound() {
  return <main className="mx-auto max-w-3xl px-gutter py-28 text-center"><h1 className="font-display text-6xl font-black">404</h1><p className="mt-4 text-secondary">That page does not exist.</p><Link className="mt-6 inline-block text-accent underline" to="/">Back home</Link></main>;
}

import { useState } from 'react';
import { authService, AuthServiceError } from '../../services/authService';
import { Button, Card } from '../../components/ui/Primitives';

export function AuthForm({ signup }: { signup: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next = {
      email: /^\S+@\S+\.\S+$/.test(email) ? undefined : 'Enter a valid email address.',
      password: password.length >= 8 ? undefined : 'Use at least 8 characters.',
    };
    setErrors(next);
    setNotice('');
    if (next.email || next.password) return;
    setBusy(true);
    try {
      if (signup) await authService.signup(email, password);
      else await authService.login(email, password);
    } catch (error) {
      setNotice(error instanceof AuthServiceError && error.code === 'NOT_CONFIGURED' ? "Accounts aren't enabled on this deployment yet." : error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    setNotice('');
    try { await authService.google(); } catch (error) { setNotice(error instanceof AuthServiceError && error.code === 'NOT_CONFIGURED' ? "Accounts aren't enabled on this deployment yet." : 'Google sign-in is unavailable right now.'); }
  };
  return <main className="mx-auto max-w-md px-gutter py-20"><Card><h1 className="font-display text-3xl font-black">{signup ? 'Create your account' : 'Welcome back'}</h1><form className="mt-7 space-y-4" onSubmit={submit} noValidate><label className="block text-sm font-semibold">Email<input className={`mt-2 w-full rounded-lg border bg-surface px-4 py-3 font-normal ${errors.email ? 'border-danger' : 'border-subtle'}`} value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} />{errors.email && <span className="mt-1 block text-sm text-danger">{errors.email}</span>}</label><label className="block text-sm font-semibold">Password<input className={`mt-2 w-full rounded-lg border bg-surface px-4 py-3 font-normal ${errors.password ? 'border-danger' : 'border-subtle'}`} value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={signup ? 'new-password' : 'current-password'} aria-invalid={Boolean(errors.password)} />{errors.password && <span className="mt-1 block text-sm text-danger">{errors.password}</span>}</label>{notice && <p role="alert" className="rounded-lg bg-accent-soft p-3 text-sm text-secondary">{notice}</p>}<Button disabled={busy} className="w-full bg-accent text-on-accent">{busy ? 'Working…' : signup ? 'Sign Up' : 'Login'}</Button><Button type="button" className="w-full border border-subtle" onClick={() => void google()}>Continue with Google</Button></form></Card></main>;
}

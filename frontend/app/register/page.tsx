'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setLoading(true);
    try {
      const result = await api.register({ username, email, password });
      setStatus(`Account created for ${result.username}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (status) {
    return (
      <main className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-16">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-green-50 text-[color:var(--color-success)]">
            <CheckCircle size={32} strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-semibold">{status}</h1>
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            Your account is ready. Sign in to start shopping.
          </p>
          <Button asChild variant="primary" size="lg" className="mt-2">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <span className="grid size-8 place-items-center rounded-lg bg-[color:var(--color-foreground)] text-white">
              <span className="text-sm font-semibold">P</span>
            </span>
            <span className="text-lg font-semibold tracking-tight">PRISM</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ letterSpacing: '-0.02em' }}>Create an account</h1>
          <p className="mt-2 text-sm text-[color:var(--color-muted-foreground)]">
            Join PRISM and start shopping today.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-sm font-medium">Username</label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="johndoe"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              minLength={8}
              required
            />
          </div>

          {error && (
            <div className="rounded-[10px] border border-[color:var(--color-danger)]/20 bg-[color:var(--color-danger)]/5 px-4 py-3 text-sm text-[color:var(--color-danger)]">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full mt-2">
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-[color:var(--color-foreground)] underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

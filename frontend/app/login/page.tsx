'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [, setSession] = useSession();
  // Deterministic anchor хэрэглэгчид (db/seed.py-с). Одоогийн default нь michaelw (victim).
  // Хүчтэй PW нь seed бүрд ижилхэн — SEED=42. Attack script `.env`-с уншина.
  const [username, setUsername] = useState('michaelw');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.login({ username, password });
      setSession({ token: result.access_token, role: result.role, user_id: result.user_id });
      router.push('/profile');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl font-semibold tracking-tight" style={{ letterSpacing: '-0.02em' }}>Sign in to your account</h1>
          <p className="mt-2 text-sm text-[color:var(--color-muted-foreground)]">
            Welcome back. Enter your details below.
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
              placeholder="michaelw"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="pr-11"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
              >
                {showPw ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-[10px] border border-[color:var(--color-danger)]/20 bg-[color:var(--color-danger)]/5 px-4 py-3 text-sm text-[color:var(--color-danger)]">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full mt-2">
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
          No account?{' '}
          <Link href="/register" className="font-medium text-[color:var(--color-foreground)] underline underline-offset-4">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}

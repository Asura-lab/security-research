'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, Heart, User, Menu, X } from 'lucide-react';
import { AnnouncementBar } from './announcement-bar';
import { HeaderCart } from './header-cart';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Shop' },
  { href: '/categories', label: 'Categories' },
];

export function SiteHeader() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/shop?q=${encodeURIComponent(query)}` : '/shop');
  };

  return (
    <>
      <AnnouncementBar />
      <header className="sticky top-0 z-40 border-b border-[color:var(--color-border)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[var(--container-content)] items-center gap-6 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-[color:var(--color-foreground)] text-white">
              <span className="text-sm font-semibold tracking-tight">P</span>
            </span>
            <span className="text-xl font-semibold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              PRISM
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-sm font-medium text-[color:var(--color-foreground)] transition-colors hover:text-[color:var(--color-primary)]"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <form onSubmit={submit} className="ml-auto hidden max-w-[420px] flex-1 md:flex">
            <div className="relative w-full">
              <Search
                size={16}
                strokeWidth={1.5}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--color-muted-foreground)]"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search 194 products"
                className="h-11 w-full rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] pl-10 pr-4 text-sm placeholder:text-[color:var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
              />
            </div>
          </form>
          <div className="flex items-center gap-1 md:ml-2">
            <Link
              href="/profile"
              aria-label="Account"
              className="hidden size-10 place-items-center rounded-full text-[color:var(--color-foreground)] transition-colors hover:bg-[color:var(--color-surface)] md:grid"
            >
              <User size={20} strokeWidth={1.5} />
            </Link>
            <Link
              href="/shop"
              aria-label="Wishlist"
              className="hidden size-10 place-items-center rounded-full text-[color:var(--color-foreground)] transition-colors hover:bg-[color:var(--color-surface)] md:grid"
            >
              <Heart size={20} strokeWidth={1.5} />
            </Link>
            <HeaderCart />
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
              className="grid size-10 place-items-center rounded-full text-[color:var(--color-foreground)] transition-colors hover:bg-[color:var(--color-surface)] md:hidden"
            >
              {mobileOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
            </button>
          </div>
        </div>
        <div
          className={cn(
            'border-t border-[color:var(--color-border)] bg-white md:hidden',
            mobileOpen ? 'block' : 'hidden',
          )}
        >
          <div className="mx-auto max-w-[var(--container-content)] px-4 py-4">
            <form onSubmit={submit} className="mb-4">
              <div className="relative">
                <Search
                  size={16}
                  strokeWidth={1.5}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--color-muted-foreground)]"
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search"
                  className="h-11 w-full rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] pl-10 pr-4 text-sm focus:outline-none"
                />
              </div>
            </form>
            <nav className="flex flex-col gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-[color:var(--color-surface)]"
                >
                  {n.label}
                </Link>
              ))}
              <div className="my-2 h-px bg-[color:var(--color-border)]" />
              <Link href="/login" className="rounded-lg px-3 py-3 text-sm">
                Sign in
              </Link>
              <Link href="/register" className="rounded-lg px-3 py-3 text-sm">
                Create account
              </Link>
            </nav>
          </div>
        </div>
      </header>
    </>
  );
}

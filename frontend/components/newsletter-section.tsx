'use client';

import { useState } from 'react';
import { Check, Mail } from 'lucide-react';
import { Button } from './ui/button';

export function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setDone(true);
  };

  return (
    <section className="bg-[color:var(--color-foreground)] text-white">
      <div className="mx-auto max-w-[var(--container-content)] px-4 py-20 text-center md:px-6">
        <div className="section-label mb-6 text-white/50">07 — Stay updated</div>
        <h2 className="text-4xl font-semibold tracking-tight md:text-5xl" style={{ letterSpacing: '-0.03em' }}>
          Get the best deals first.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base text-white/60">
          Join over 40,000 shoppers who get exclusive deals, early access to new arrivals, and weekly
          curated picks.
        </p>
        {done ? (
          <div className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-medium">
            <Check size={16} strokeWidth={2} />
            You are on the list. Welcome to PRISM.
          </div>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-8 flex max-w-md gap-3">
            <div className="relative flex-1">
              <Mail
                size={16}
                strokeWidth={1.5}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                required
                className="h-12 w-full rounded-full border border-white/20 bg-white/10 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
            </div>
            <Button type="submit" variant="primary" size="pill">
              Subscribe
            </Button>
          </form>
        )}
        <p className="mt-4 text-xs text-white/30">
          No spam, unsubscribe at any time.
        </p>
      </div>
    </section>
  );
}

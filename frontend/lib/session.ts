'use client';

import { useEffect, useState } from 'react';

const KEY = 'security-research-token';

export interface Session {
  token: string;
  role: 'customer' | 'admin';
  user_id: number;
}

export function useSession(): [Session | null, (session: Session | null) => void] {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSession(JSON.parse(raw) as Session);
    } catch {
      // ignore
    }
  }, []);
  const update = (next: Session | null) => {
    if (next) {
      localStorage.setItem(KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(KEY);
    }
    setSession(next);
  };
  return [session, update];
}

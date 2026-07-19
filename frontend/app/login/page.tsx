'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function LoginPage() {
  const [, setSession] = useSession();
  const [username, setUsername] = useState('victim');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await api.login({ username, password });
      setSession({ token: result.access_token, role: result.role, user_id: result.user_id });
      router.push('/profile');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  };

  return (
    <section>
      <h1>Нэвтрэх</h1>
      <form onSubmit={onSubmit}>
        <label>Хэрэглэгчийн нэр<input value={username} onChange={(e) => setUsername(e.target.value)} /></label>
        <label>Нууц үг<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button type="submit">Нэвтрэх</button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

'use client';

import { useState } from 'react';
import { ApiError, api } from '@/lib/api';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const result = await api.register({ username, email, password });
      setStatus(`Хэрэглэгч ${result.username} үүсэв (id=${result.user_id})`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  };

  return (
    <section>
      <h1>Бүртгүүлэх</h1>
      <form onSubmit={onSubmit}>
        <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} /></label>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button type="submit">Бүртгүүлэх</button>
      </form>
      {status && <p>{status}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

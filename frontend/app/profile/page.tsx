'use client';

import { useEffect, useState } from 'react';
import { ApiError, api, type Profile } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function ProfilePage() {
  const [session] = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!session) return;
    setError(null);
    try {
      const result = await api.profile(session.token);
      setProfile(result.profile);
      setName(result.profile.username);
      setAddress(result.profile.address ?? '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const save = async () => {
    if (!session) return;
    setError(null);
    try {
      const result = await api.updateProfile(session.token, { name, address });
      setProfile(result.profile);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  };

  if (!session) return <p>Эхлээд нэвтэрнэ үү.</p>;
  return (
    <section>
      <h1>Профайл</h1>
      {profile && (
        <>
          <p>user_id={profile.user_id} role={profile.role} is_admin={String(profile.is_admin)}</p>
          <label>Нэр<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Хаяг<input value={address} onChange={(e) => setAddress(e.target.value)} /></label>
          <button onClick={save}>Хадгалах</button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

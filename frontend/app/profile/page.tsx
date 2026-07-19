'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { User, MapPin, Mail, Shield, Save } from 'lucide-react';
import { ApiError, api, type Profile } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function ProfilePage() {
  const [session] = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
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
    setLoading(true);
    try {
      const result = await api.updateProfile(session.token, { name, address });
      setProfile(result.profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <main className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-16">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-[color:var(--color-surface)] text-[color:var(--color-muted-foreground)]">
            <User size={28} strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-semibold">Sign in required</h1>
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            You need to be signed in to view your profile.
          </p>
          <Button asChild variant="primary" size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 md:px-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
        My Profile
      </h1>

      {profile && (
        <div className="flex flex-col gap-6">
          {/* Info card */}
          <div className="rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
            <div className="flex items-center gap-4">
              <div className="grid size-16 place-items-center rounded-full border border-[color:var(--color-border)] bg-white text-xl font-semibold text-[color:var(--color-foreground)]">
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{profile.username}</span>
                  <Badge variant={profile.is_admin ? 'accent' : 'muted'}>
                    {profile.is_admin ? 'Admin' : 'Customer'}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-sm text-[color:var(--color-muted-foreground)]">
                  <Mail size={14} strokeWidth={1.5} />
                  {profile.email}
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[color:var(--color-border)] pt-5 text-sm">
              <div>
                <div className="text-[color:var(--color-muted-foreground)]">User ID</div>
                <div className="font-medium tabular-nums">{profile.user_id}</div>
              </div>
              <div>
                <div className="text-[color:var(--color-muted-foreground)]">Role</div>
                <div className="font-medium capitalize">{profile.role}</div>
              </div>
            </div>
          </div>

          {/* Edit form */}
          <div className="rounded-[14px] border border-[color:var(--color-border)] bg-white p-6">
            <h2 className="mb-5 font-semibold">Edit details</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-sm font-medium">Username</label>
                <div className="relative">
                  <User size={16} strokeWidth={1.5} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--color-muted-foreground)]" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="address" className="text-sm font-medium">Address</label>
                <div className="relative">
                  <MapPin size={16} strokeWidth={1.5} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--color-muted-foreground)]" />
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Your shipping address"
                    className="pl-10"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-[10px] border border-[color:var(--color-danger)]/20 bg-[color:var(--color-danger)]/5 px-4 py-3 text-sm text-[color:var(--color-danger)]">
                  {error}
                </div>
              )}

              <Button
                onClick={save}
                disabled={loading}
                variant={saved ? 'dark' : 'primary'}
                size="md"
                className="self-start"
              >
                <Save size={16} strokeWidth={1.5} />
                {saved ? 'Saved' : loading ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!profile && !error && (
        <div className="flex items-center gap-3 py-8 text-sm text-[color:var(--color-muted-foreground)]">
          <div className="size-4 animate-spin rounded-full border-2 border-[color:var(--color-border)] border-t-[color:var(--color-foreground)]" />
          Loading profile...
        </div>
      )}

      {error && !profile && (
        <div className="rounded-[10px] border border-[color:var(--color-danger)]/20 bg-[color:var(--color-danger)]/5 px-4 py-3 text-sm text-[color:var(--color-danger)]">
          {error}
        </div>
      )}
    </main>
  );
}

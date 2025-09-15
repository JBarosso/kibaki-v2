import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ensureOwnProfile, updateUsername } from '@/lib/profiles';

type Profile = { id: string; username: string; created_at: string; updated_at: string };

export default function AccountIsland() {
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<'signin'|'signup'>('signin');

  // form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setLoading(false);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session) { setProfile(null); return; }
      try {
        const p = await ensureOwnProfile(); // may insert if missing (DB trigger should have created it anyway)
        setProfile(p as Profile);
      } catch (e:any) {
        setErrorMsg(e.message ?? String(e));
      }
    };
    fetchProfile();
  }, [session]);

  const doSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErrorMsg(error.message);
  };

  const doSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setErrorMsg(error.message); return; }
    if (data.session) {
      try { await ensureOwnProfile(username || undefined); }
      catch (e:any) { setErrorMsg(e.message ?? String(e)); }
    } else {
      // email confirmation flow
      setErrorMsg('Check your email to confirm your account, then come back here to log in.');
    }
  };

  const doUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const updated = await updateUsername(username);
      setProfile(updated as Profile);
      setUsername('');
    } catch (e:any) {
      setErrorMsg(e.message ?? String(e));
    }
  };

  const doSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  if (!session) {
    return (
      <div className="max-w-md mx-auto p-6 rounded-2xl shadow border mt-8 bg-white">
        <div className="flex gap-3 mb-4">
          <button className={`px-3 py-1 rounded ${mode==='signin'?'bg-black text-white':'bg-gray-100'}`} onClick={()=>setMode('signin')}>Sign in</button>
          <button className={`px-3 py-1 rounded ${mode==='signup'?'bg-black text-white':'bg-gray-100'}`} onClick={()=>setMode('signup')}>Sign up</button>
        </div>

        {mode==='signin' ? (
          <form onSubmit={doSignIn} className="space-y-3">
            <input className="w-full border rounded px-3 py-2" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
            <input className="w-full border rounded px-3 py-2" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
            <button className="w-full bg-black text-white rounded px-3 py-2">Sign in</button>
          </form>
        ) : (
          <form onSubmit={doSignUp} className="space-y-3">
            <input className="w-full border rounded px-3 py-2" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
            <input className="w-full border rounded px-3 py-2" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
            <input className="w-full border rounded px-3 py-2" type="text" placeholder="Username (optional)" value={username} onChange={e=>setUsername(e.target.value)} />
            <button className="w-full bg-black text-white rounded px-3 py-2">Sign up</button>
          </form>
        )}

        {errorMsg && <p className="mt-3 text-sm text-red-600">{errorMsg}</p>}
        <p className="mt-3 text-xs text-gray-500">Note: profiles are auto-created by a DB trigger; we also ensure it client-side.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 rounded-2xl shadow border mt-8 bg-white">
      <div className="mb-3 text-sm text-gray-600">Signed in as <strong>{session.user?.email}</strong></div>
      <div className="mb-4">
        <div className="text-xs text-gray-500">Current username</div>
        <div className="text-lg font-semibold">{profile?.username ?? '—'}</div>
      </div>

      <form onSubmit={doUpdateUsername} className="space-y-3">
        <input className="w-full border rounded px-3 py-2" type="text" placeholder="New username" value={username} onChange={e=>setUsername(e.target.value)} required />
        <button className="w-full bg-black text-white rounded px-3 py-2">Update username</button>
      </form>

      <button onClick={doSignOut} className="w-full mt-4 border rounded px-3 py-2">Sign out</button>
      {errorMsg && <p className="mt-3 text-sm text-red-600">{errorMsg}</p>}
    </div>
  );
}

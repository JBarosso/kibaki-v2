import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import humanizeError from '@/lib/humanizeError';
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
  // change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwSuccessMsg, setPwSuccessMsg] = useState<string | null>(null);
  const [pwErrorMsg, setPwErrorMsg] = useState<string | null>(null);

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
        setErrorMsg(humanizeError(e));
      }
    };
    fetchProfile();
  }, [session]);

  const doSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErrorMsg(humanizeError(error));
  };

  const doSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setErrorMsg(humanizeError(error)); return; }
    if (data.session) {
      try { await ensureOwnProfile(username || undefined); }
      catch (e:any) { setErrorMsg(humanizeError(e)); }
    } else {
      // email confirmation flow
      setErrorMsg('Vérifiez votre email pour confirmer votre compte, puis revenez ici pour vous connecter.');
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
      setErrorMsg(humanizeError(e));
    }
  };

  const doSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const doChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErrorMsg(null);
    setPwSuccessMsg(null);

    if (newPassword.length < 8) {
      setPwErrorMsg('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErrorMsg('Les mots de passe ne correspondent pas.');
      return;
    }

    setPwSubmitting(true);
    try {
      // Optionnel: réauthentifier si l'utilisateur a fourni son mot de passe actuel
      if (currentPassword && session?.user?.email) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: session.user.email,
          password: currentPassword,
        });
        if (reauthError) {
          setPwErrorMsg(humanizeError(reauthError));
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPwErrorMsg(humanizeError(error));
      } else {
        setPwSuccessMsg('Mot de passe mis à jour avec succès.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPwErrorMsg(humanizeError(err));
    } finally {
      setPwSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-gray-500">Chargement…</div>;

  if (!session) {
    return (
      <div className="max-w-md mx-auto p-6 rounded-2xl shadow border mt-8 bg-white">
        <div className="flex gap-3 mb-4">
          <button className={`px-3 py-1 rounded ${mode==='signin'?'bg-black text-white':'bg-gray-100'}`} onClick={()=>setMode('signin')}>Se connecter</button>
          <button className={`px-3 py-1 rounded ${mode==='signup'?'bg-black text-white':'bg-gray-100'}`} onClick={()=>setMode('signup')}>Créer un compte</button>
        </div>

        {mode==='signin' ? (
          <form onSubmit={doSignIn} className="space-y-3">
            <input className="w-full border rounded px-3 py-2" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
            <input className="w-full border rounded px-3 py-2" type="password" placeholder="Mot de passe" value={password} onChange={e=>setPassword(e.target.value)} required />
            <button className="w-full bg-black text-white rounded px-3 py-2">Se connecter</button>
          </form>
        ) : (
          <form onSubmit={doSignUp} className="space-y-3">
            <input className="w-full border rounded px-3 py-2" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
            <input className="w-full border rounded px-3 py-2" type="password" placeholder="Mot de passe" value={password} onChange={e=>setPassword(e.target.value)} required />
            <input className="w-full border rounded px-3 py-2" type="text" placeholder="Pseudo (optionnel)" value={username} onChange={e=>setUsername(e.target.value)} />
            <button className="w-full bg-black text-white rounded px-3 py-2">Créer un compte</button>
          </form>
        )}

        {errorMsg && <p className="mt-3 text-sm text-red-600">{errorMsg}</p>}
        <p className="mt-3 text-xs text-gray-500">Note: profiles are auto-created by a DB trigger; we also ensure it client-side.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 rounded-2xl shadow border mt-8 bg-white">
      <div className="mb-3 text-sm text-gray-600">Connecté en tant que <strong>{session.user?.email}</strong></div>
      <div className="mb-4">
        <div className="text-xs text-gray-500">Pseudo actuel</div>
        <div className="text-lg font-semibold">{profile?.username ?? '—'}</div>
      </div>

      <form onSubmit={doUpdateUsername} className="space-y-3">
        <input className="w-full border rounded px-3 py-2" type="text" placeholder="Nouveau pseudo" value={username} onChange={e=>setUsername(e.target.value)} required />
        <button className="w-full bg-black text-white rounded px-3 py-2">Mettre à jour le pseudo</button>
      </form>

      <div className="mt-6 pt-6 border-t">
        <h2 className="text-lg font-semibold mb-3">Changer le mot de passe</h2>
        <form onSubmit={doChangePassword} className="space-y-3">
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            placeholder="Mot de passe actuel (optionnel)"
            value={currentPassword}
            onChange={(e)=>setCurrentPassword(e.target.value)}
          />
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            placeholder="Nouveau mot de passe"
            value={newPassword}
            onChange={(e)=>setNewPassword(e.target.value)}
            required
          />
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={(e)=>setConfirmPassword(e.target.value)}
            required
          />
          <button className="w-full bg-black text-white rounded px-3 py-2 disabled:opacity-60" disabled={pwSubmitting}>
            {pwSubmitting ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
          </button>
        </form>
        {pwSuccessMsg && <p className="mt-3 text-sm text-green-700">{pwSuccessMsg}</p>}
        {pwErrorMsg && <p className="mt-3 text-sm text-red-600">{pwErrorMsg}</p>}
      </div>

      <button onClick={doSignOut} className="w-full mt-4 border rounded px-3 py-2">Se déconnecter</button>
      {errorMsg && <p className="mt-3 text-sm text-red-600">{errorMsg}</p>}
    </div>
  );
}

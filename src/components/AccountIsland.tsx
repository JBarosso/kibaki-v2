import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import humanizeError from '@/lib/humanizeError';
import { ensureOwnProfile, updateUsername } from '@/lib/profiles';
import { showToast } from '@/lib/toast';

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

    if (!currentPassword) {
      setPwErrorMsg('Le mot de passe actuel est requis.');
      return;
    }
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
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.email) throw new Error('Session invalide.');

      const r = await supabase.auth.signInWithPassword({
        email: user.user.email,
        password: currentPassword,
      });
      if ((r as any).error) throw (r as any).error;

      const upd = await supabase.auth.updateUser({ password: newPassword });
      if ((upd as any).error) throw (upd as any).error;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast({ type: 'success', message: 'Mot de passe mis à jour.' });
    } catch (err: any) {
      setPwErrorMsg(humanizeError(err));
    } finally {
      setPwSubmitting(false);
    }
  };

  if (loading) return <div className="account-island__loading">Chargement…</div>;

  if (!session) {
    return (
      <div className="account-island__signin-wrapper">
        <div className="account-island__mode-tabs">
          <button className={`account-island__mode-tab ${mode==='signin'?'account-island__mode-tab--active':''}`} onClick={()=>setMode('signin')}>Se connecter</button>
          <button className={`account-island__mode-tab ${mode==='signup'?'account-island__mode-tab--active':''}`} onClick={()=>setMode('signup')}>Créer un compte</button>
        </div>

        {mode==='signin' ? (
          <form onSubmit={doSignIn} className="account-island__form">
            <input className="form-input" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
            <input className="form-input" type="password" placeholder="Mot de passe" value={password} onChange={e=>setPassword(e.target.value)} required />
            <div className="account-island__forgot-link">
              <a href="/forgot">Mot de passe oublié ?</a>
            </div>
            <button type="submit" className="form-button form-button--primary form-button--full-width">Se connecter</button>
          </form>
        ) : (
          <form onSubmit={doSignUp} className="account-island__form">
            <input className="form-input" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
            <input className="form-input" type="password" placeholder="Mot de passe" value={password} onChange={e=>setPassword(e.target.value)} required />
            <input className="form-input" type="text" placeholder="Pseudo (optionnel)" value={username} onChange={e=>setUsername(e.target.value)} />
            <button type="submit" className="form-button form-button--primary form-button--full-width">Créer un compte</button>
          </form>
        )}

        {errorMsg && <p className="account-island__error">{errorMsg}</p>}
        <p className="account-island__note">Note: profiles are auto-created by a DB trigger; we also ensure it client-side.</p>
      </div>
    );
  }

  return (
    <div className="account-island__profile-wrapper">
      <div className="account-island__profile-info">Connecté en tant que <strong>{session.user?.email}</strong></div>
      <div>
        <div className="account-island__profile-label">Pseudo actuel</div>
        <div className="account-island__profile-username">{profile?.username ?? '—'}</div>
      </div>

      <form onSubmit={doUpdateUsername} className="account-island__update-form">
        <input className="form-input" type="text" placeholder="Nouveau pseudo" value={username} onChange={e=>setUsername(e.target.value)} required />
        <button type="submit" className="form-button form-button--primary form-button--full-width">Mettre à jour le pseudo</button>
      </form>

      <div className="account-island__password-section">
        <h2 className="account-island__password-title">Changer le mot de passe</h2>
        <form onSubmit={doChangePassword} className="account-island__password-form">
          <input
            className="form-input"
            type="password"
            placeholder="Mot de passe actuel"
            value={currentPassword}
            onChange={(e)=>setCurrentPassword(e.target.value)}
            required
          />
          <input
            className="form-input"
            type="password"
            placeholder="Nouveau mot de passe"
            value={newPassword}
            onChange={(e)=>setNewPassword(e.target.value)}
            required
          />
          <input
            className="form-input"
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={(e)=>setConfirmPassword(e.target.value)}
            required
          />
          <button type="submit" className="form-button form-button--primary form-button--full-width" disabled={pwSubmitting}>
            {pwSubmitting ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
          </button>
        </form>
        {pwSuccessMsg && <p className="account-island__password-success">{pwSuccessMsg}</p>}
        {pwErrorMsg && <p className="account-island__password-error">{pwErrorMsg}</p>}
      </div>

      <button onClick={doSignOut} className="form-button form-button--danger form-button--full-width">Se déconnecter</button>
      {errorMsg && <p className="account-island__error">{errorMsg}</p>}
    </div>
  );
}

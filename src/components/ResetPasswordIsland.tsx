import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordIsland() {
  const [stage, setStage] = useState<'waiting'|'form'|'success'>('waiting');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStage('form');
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Les mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setStage('success');
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reset-password">
      <div className="reset-password__wrapper">
        {stage === 'waiting' && (
          <p className="reset-password__waiting">En attente d'un lien de récupération valide…</p>
        )}

        {stage === 'form' && (
          <form onSubmit={onSubmit} className="reset-password__form">
            <input
              className="reset-password__input"
              type="password"
              placeholder="Nouveau mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <input
              className="reset-password__input"
              type="password"
              placeholder="Confirmer le mot de passe"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <button
              className={`reset-password__submit-button ${submitting ? 'reset-password__submit-button--disabled' : ''}`}
              disabled={submitting}
            >
              {submitting ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
            </button>
          </form>
        )}

        {stage === 'success' && (
          <div className="reset-password__success">
            <p className="reset-password__success-message">Mot de passe mis à jour avec succès.</p>
            <a href="/account" className="reset-password__success-link">Aller à mon compte</a>
          </div>
        )}

        {errorMsg && <p className="reset-password__error">{errorMsg}</p>}
      </div>
    </div>
  );
}



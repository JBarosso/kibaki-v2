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
    <div className="max-w-md mx-auto p-6 rounded-2xl shadow border mt-6 bg-white">
      {stage === 'waiting' && (
        <p className="text-sm text-gray-600">En attente d'un lien de récupération valide…</p>
      )}

      {stage === 'form' && (
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            placeholder="Nouveau mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <button
            className="w-full bg-black text-white rounded px-3 py-2 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
          </button>
        </form>
      )}

      {stage === 'success' && (
        <div>
          <p className="text-sm text-green-700">Mot de passe mis à jour avec succès.</p>
          <a href="/account" className="inline-block mt-3 underline">Aller à mon compte</a>
        </div>
      )}

      {errorMsg && <p className="mt-3 text-sm text-red-600">{errorMsg}</p>}
    </div>
  );
}



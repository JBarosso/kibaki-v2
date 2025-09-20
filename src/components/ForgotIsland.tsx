import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotIsland() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setErrorMsg(null);

    if (!EMAIL_REGEX.test(email)) {
      setErrorMsg('Veuillez entrer une adresse email valide.');
      return;
    }

    const siteUrl = import.meta.env.PUBLIC_SITE_URL as string | undefined;
    if (!siteUrl) {
      setErrorMsg('Configuration manquante: PUBLIC_SITE_URL');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/reset`,
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setMessage("Si un compte existe, un email de réinitialisation a été envoyé.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 rounded-2xl shadow border mt-6 bg-white">
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full border rounded px-3 py-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          className="w-full bg-black text-white rounded px-3 py-2 disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? 'Envoi…' : 'Envoyer le lien'}
        </button>
      </form>
      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      {errorMsg && <p className="mt-3 text-sm text-red-600">{errorMsg}</p>}
    </div>
  );
}



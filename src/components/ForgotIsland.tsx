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
    <div className="forgot-island">
      <form onSubmit={onSubmit} className="forgot-island__form">
        <input
          className="forgot-island__input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          className={`forgot-island__submit-button ${submitting ? 'forgot-island__submit-button--disabled' : ''}`}
          disabled={submitting}
        >
          {submitting ? 'Envoi…' : 'Envoyer le lien'}
        </button>
      </form>
      {message && <p className="forgot-island__message">{message}</p>}
      {errorMsg && <p className="forgot-island__error">{errorMsg}</p>}
    </div>
  );
}



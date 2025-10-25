import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ensureOwnProfile } from '@/lib/profiles';
import { showToast } from '@/lib/toast';
import CustomSelect from '@/components/CustomSelect';

type UniverseRow = { id: number; slug: string; name: string };

type InsertPayload = {
  user_id: string;
  universe_id: number | null;
  proposed_universe: string | null;
  character_name: string;
  description: string;
  image_url: string | null;
  status: 'pending';
};

export default function SubmitIsland() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const [universes, setUniverses] = useState<UniverseRow[]>([]);
  const [universesLoading, setUniversesLoading] = useState(true);
  const [universesError, setUniversesError] = useState<string | null>(null);

  // form state
  const [selectValue, setSelectValue] = useState<string>(''); // '' | 'other' | universeId string
  const [proposedUniverse, setProposedUniverse] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ username: string } | null>(null);

  const firstInputRef = useRef<HTMLDivElement | null>(null);

  const resetForm = () => {
    setSelectValue('');
    setProposedUniverse('');
    setCharacterName('');
    setDescription('');
    setImageUrl('');
    setSuccess(null);
    setTimeout(() => {
      firstInputRef.current?.focus();
    }, 0);
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setIsSignedIn(!!data.session);
      setSessionLoading(false);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setIsSignedIn(!!sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadUniverses = async () => {
      setUniversesLoading(true);
      setUniversesError(null);
      const { data, error } = await supabase
        .from('univers')
        .select('id, slug, name')
        .order('name', { ascending: true });
      if (error) {
        setUniversesError(error.message);
      } else {
        setUniverses((data ?? []) as UniverseRow[]);
      }
      setUniversesLoading(false);
    };
    loadUniverses();
  }, []);

  const canShowProposed = useMemo(() => selectValue === 'other', [selectValue]);

  const validate = (): string | null => {
    const name = characterName.trim();
    if (!name) return 'Le nom du personnage est requis.';

    if (selectValue === 'other') {
      if (!proposedUniverse.trim()) return "Veuillez proposer un univers.";
      return null;
    }

    if (!selectValue) return 'Veuillez sélectionner un univers ou choisir « Other… ».';

    const n = Number(selectValue);
    if (!Number.isFinite(n)) return 'Sélection d\'univers invalide.';
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const validationError = validate();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData, error: uerr } = await supabase.auth.getUser();
      if (uerr || !userData.user) throw new Error("Vous devez être connecté.");
      const uid = userData.user.id;

      const payload: InsertPayload = {
        user_id: uid,
        universe_id: selectValue === 'other' ? null : Number(selectValue),
        proposed_universe: selectValue === 'other' ? proposedUniverse.trim() : null,
        character_name: characterName.trim(),
        description: description.trim(),
        image_url: imageUrl.trim() || null,
        status: 'pending',
      };

      const { error: insErr } = await supabase
        .from('submissions')
        .insert(payload)
        .select('id')
        .single();
      if (insErr) throw insErr;

      // Get username for success link
      const profile = await ensureOwnProfile();
      const username = (profile as any)?.username as string | undefined;
      setSuccess({ username: username ?? '' });
      showToast({ type: 'success', message: 'Soumission envoyée' });
    } catch (e: any) {
      setSubmitError(e.message ?? String(e));
      showToast({ type: 'error', message: 'Échec de la soumission.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionLoading) {
    return <div className="submit-island__loading">Chargement…</div>;
  }

  if (!isSignedIn) {
    return (
      <div className="submit-island__signin-prompt">
        <div className="submit-island__signin-message">Vous devez être connecté pour soumettre un personnage.</div>
        <a href="/account" className="form-button form-button--primary">
          Se connecter / Créer un compte
        </a>
      </div>
    );
  }

  if (success) {
    return (
      <div className="submit-island__success">
        <h2 className="submit-island__success-title">Merci !</h2>
        <p className="submit-island__success-message">Votre soumission a été enregistrée et sera examinée.</p>
        <div className="submit-island__success-actions">
          <button type="button" className="form-button form-button--primary" onClick={resetForm}>
            Nouvelle soumission
          </button>
          <a href="/duel" className="form-button form-button--secondary">
            Retourner aux duels
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="submit-island__form-wrapper">
      <h2 className="submit-island__title">Soumettre un personnage</h2>
      <form onSubmit={onSubmit} className="submit-island__form">
        <div className="submit-island__field">
          <label className="submit-island__label">Univers</label>
          <CustomSelect
            options={[
              { value: '', label: '— Sélectionner —' },
              ...universes.map((u) => ({ value: String(u.id), label: u.name })),
              { value: 'other', label: 'Other…' }
            ]}
            value={selectValue}
            onChange={setSelectValue}
            disabled={universesLoading}
            className="submit-island__select custom-select--form"
          />
          {universesError && (
            <p className="submit-island__error">{universesError}</p>
          )}
        </div>

        {canShowProposed && (
          <div className="submit-island__field">
            <label className="submit-island__label">Proposer un univers</label>
            <input
              type="text"
              className="form-input"
              placeholder="Nom de l'univers"
              value={proposedUniverse}
              onChange={(e) => setProposedUniverse(e.target.value)}
            />
          </div>
        )}

        <div className="submit-island__field">
          <label className="submit-island__label">Nom du personnage</label>
          <input
            type="text"
            className="form-input"
            placeholder="Ex. Naruto Uzumaki"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            required
          />
        </div>

        <div className="submit-island__field">
          <label className="submit-island__label">Description</label>
          <textarea
            className="form-textarea"
            rows={4}
            placeholder="Brève description du personnage"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="submit-island__field">
          <label className="submit-island__label">Image URL (optionnel)</label>
          <input
            type="url"
            className="form-input"
            placeholder="https://…"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>

        {submitError && (
          <p className="submit-island__error">{submitError}</p>
        )}

        <button
          type="submit"
          className="form-button form-button--primary form-button--full-width"
          disabled={submitting}
        >
          {submitting ? 'Envoi…' : 'Soumettre'}
        </button>
      </form>
    </div>
  );
}



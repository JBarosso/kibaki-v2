import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ensureOwnProfile } from '@/lib/profiles';
import { showToast } from '@/lib/toast';

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

  const firstInputRef = useRef<HTMLSelectElement | null>(null);

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
    return <div className="p-6 text-sm text-gray-500">Chargement…</div>;
  }

  if (!isSignedIn) {
    return (
      <div className="max-w-md mx-auto p-6 rounded-2xl shadow border mt-8 bg-white">
        <div className="text-sm text-gray-700">Vous devez être connecté pour soumettre un personnage.</div>
        <a href="/account" className="mt-4 inline-flex items-center justify-center rounded bg-black px-4 py-2 text-white">
          Se connecter / Créer un compte
        </a>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto p-6 rounded-2xl shadow border mt-8 bg-white">
        <h2 className="text-lg font-semibold">Merci !</h2>
        <p className="mt-2 text-sm text-gray-700">Votre soumission a été enregistrée et sera examinée.</p>
        <div className="mt-4 flex gap-3">
          <button type="button" className="rounded border px-3 py-2" onClick={resetForm}>
            Nouvelle soumission
          </button>
          <a className="rounded bg-black px-3 py-2 text-white" href="/duel">Retourner aux duels</a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 rounded-2xl shadow border mt-8 bg-white">
      <h2 className="mb-4 text-xl font-bold">Soumettre un personnage</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Univers</label>
          <select
            className="mt-1 w-full rounded border px-3 py-2 bg-white"
            value={selectValue}
            onChange={(e) => setSelectValue(e.target.value)}
            disabled={universesLoading}
            ref={firstInputRef}
          >
            <option value="">— Sélectionner —</option>
            {universes.map((u) => (
              <option key={u.id} value={String(u.id)}>{u.name}</option>
            ))}
            <option value="other">Other…</option>
          </select>
          {universesError && (
            <p className="mt-1 text-xs text-red-600">{universesError}</p>
          )}
        </div>

        {canShowProposed && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Proposer un univers</label>
            <input
              type="text"
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="Nom de l'univers"
              value={proposedUniverse}
              onChange={(e) => setProposedUniverse(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Nom du personnage</label>
          <input
            type="text"
            className="mt-1 w-full rounded border px-3 py-2"
            placeholder="Ex. Naruto Uzumaki"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            className="mt-1 w-full rounded border px-3 py-2"
            rows={4}
            placeholder="Brève description du personnage"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Image URL (optionnel)</label>
          <input
            type="url"
            className="mt-1 w-full rounded border px-3 py-2"
            placeholder="https://…"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>

        {submitError && (
          <p className="text-sm text-red-600">{submitError}</p>
        )}

        <button
          type="submit"
          className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? 'Envoi…' : 'Soumettre'}
        </button>
      </form>
    </div>
  );
}



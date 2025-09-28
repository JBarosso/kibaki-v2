import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Universe } from '@/lib/universes';
import { fetchUniverses } from '@/lib/universes';
import type { CharacterLite } from '@/lib/characters';
import { searchCharacters } from '@/lib/characters';
import { createTournament } from '@/lib/tournaments';

type ProfileRow = { id: string; is_admin: boolean | null };

export default function TournamentNewIsland() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  // UI states
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [universeId, setUniverseId] = useState<number | null>(null);
  const [roundMinutes, setRoundMinutes] = useState<number>(60);
  const [startAt, setStartAt] = useState<string>(() => {
    const d = new Date(Date.now() + 5*60*1000);
    return d.toISOString().slice(0,16); // yyyy-mm-ddThh:mm (local)
  });

  const [universes, setUniverses] = useState<Universe[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CharacterLite[]>([]);
  const [selected, setSelected] = useState<CharacterLite[]>([]); // seed order

  const selectedIds = useMemo(()=> selected.map(c => c.id), [selected]);

  useEffect(() => {
    (async () => {
      try {
        // Auth check
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user?.id) {
          setForbidden(true);
          setLoading(false);
          return;
        }
        const uid = u.user.id;
        // Self-row read is allowed; we only need is_admin
        const { data: me, error: pErr } = await supabase
          .from('profiles')
          .select('id, is_admin')
          .eq('id', uid)
          .maybeSingle<ProfileRow>();
        if (pErr || !me || me.is_admin !== true) {
          setForbidden(true);
          setLoading(false);
          return;
        }

        // Load universes
        const { data: uni } = await fetchUniverses();
        setUniverses(uni ?? []);

        // Initial character search
        const { data: chars } = await searchCharacters({ q: '', universe_id: null, limit: 50, offset: 0 });
        setResults(chars ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function doSearch() {
    const { data } = await searchCharacters({ q, universe_id: universeId ?? null, limit: 50, offset: 0 });
    setResults(data ?? []);
  }

  function addChar(c: CharacterLite) {
    if (selectedIds.includes(c.id)) return;
    setSelected(prev => [...prev, c]);
  }
  function removeChar(id: number) {
    setSelected(prev => prev.filter(c => c.id !== id));
  }
  function moveUp(idx: number) {
    if (idx <= 0) return;
    setSelected(prev => {
      const copy = prev.slice();
      [copy[idx-1], copy[idx]] = [copy[idx], copy[idx-1]];
      return copy;
    });
  }
  function moveDown(idx: number) {
    setSelected(prev => {
      if (idx >= prev.length - 1) return prev;
      const copy = prev.slice();
      [copy[idx], copy[idx+1]] = [copy[idx+1], copy[idx]];
      return copy;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validation
    if (!name.trim()) {
      setErrorMsg('Le nom du tournoi est requis');
      return;
    }
    if (!roundMinutes || roundMinutes <= 0) {
      setErrorMsg('La durée par round doit être supérieure à 0');
      return;
    }
    if (selected.length < 2) {
      setErrorMsg('Au moins 2 participants sont requis');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // Convert local datetime to ISO
      const isoStart = (() => {
        try {
          // startAt like '2025-09-28T14:30'
          const local = new Date(startAt);
          return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
        } catch { return new Date().toISOString(); }
      })();

      const { data, error } = await createTournament({
        name: name.trim(),
        universe_id: universeId ?? null,
        round_minutes: roundMinutes,
        start_at: isoStart,
        participants: selectedIds,
      });
      
      if (error) {
        setErrorMsg(error.message || 'Erreur lors de la création du tournoi');
        return;
      }
      
      const t_id = (Array.isArray(data) ? data[0] : data) as string | { id?: string };
      // Try to extract uuid if wrapped
      const tid = typeof t_id === 'string' ? t_id : (t_id?.id ?? null);
      
      setSuccessMsg('Tournoi créé avec succès !');
      
      // Redirect after a short delay
      setTimeout(() => {
        if (tid) location.href = `/t/${tid}`;
        else location.href = '/t';
      }, 1000);
      
    } catch (err) {
      setErrorMsg('Une erreur inattendue s\'est produite');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border bg-white shadow-sm p-6">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-32 mx-auto mb-2"></div>
              <div className="h-3 bg-gray-100 rounded w-24 mx-auto"></div>
            </div>
            <p className="text-sm text-gray-500 mt-4">Chargement…</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (forbidden) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border bg-white shadow-sm p-6">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">Accès restreint</h3>
              <p className="text-sm text-red-600 mt-1">Cette fonctionnalité est réservée aux administrateurs.</p>
            </div>
            <a 
              href="/t" 
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black/60"
            >
              Retour aux tournois
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Error Message */}
      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-800">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMsg && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-green-800">{successMsg}</p>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Card 1: Informations */}
        <div className="rounded-2xl border bg-white shadow-sm p-4 md:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Informations</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du tournoi
              </label>
              <input 
                value={name} 
                onChange={e => setName(e.target.value)}
                disabled={submitting}
                className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-black/60 focus:border-black disabled:opacity-60 disabled:cursor-not-allowed" 
                placeholder="Kibaki Cup" 
              />
              <p className="text-xs text-gray-500 mt-1">Choisissez un nom accrocheur pour votre tournoi</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Univers
                </label>
                <select 
                  value={universeId ?? ''} 
                  onChange={e => setUniverseId(e.target.value ? Number(e.target.value) : null)}
                  disabled={submitting}
                  className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-black/60 focus:border-black disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">— Global —</option>
                  {universes.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">Optionnel</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Durée par round
                </label>
                <input 
                  type="number" 
                  min={1} 
                  value={roundMinutes} 
                  onChange={e => setRoundMinutes(Number(e.target.value))}
                  disabled={submitting}
                  className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-black/60 focus:border-black disabled:opacity-60 disabled:cursor-not-allowed" 
                />
                <p className="text-xs text-gray-500 mt-1">En minutes</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de début
                </label>
                <input 
                  type="datetime-local" 
                  value={startAt} 
                  onChange={e => setStartAt(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-black/60 focus:border-black disabled:opacity-60 disabled:cursor-not-allowed" 
                />
                <p className="text-xs text-gray-500 mt-1">Heure locale</p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Participants */}
        <div className="rounded-2xl border bg-white shadow-sm p-4 md:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Participants</h2>
          <p className="text-sm text-gray-600 mb-4">Recherchez et sélectionnez les personnages qui participeront au tournoi</p>
          
          {/* Search Controls */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rechercher un personnage
              </label>
              <input 
                value={q} 
                onChange={e => setQ(e.target.value)}
                disabled={submitting}
                className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-black/60 focus:border-black disabled:opacity-60 disabled:cursor-not-allowed" 
                placeholder="Batman, Goku, Naruto..." 
              />
            </div>
            <div className="sm:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtrer par univers
              </label>
              <select 
                value={universeId ?? ''} 
                onChange={e => setUniverseId(e.target.value ? Number(e.target.value) : null)}
                disabled={submitting}
                className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-black/60 focus:border-black disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">— Tous —</option>
                {universes.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="sm:w-auto flex items-end">
              <button 
                type="button" 
                onClick={doSearch}
                disabled={submitting}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-black/60 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
              >
                Chercher
              </button>
            </div>
          </div>

          {/* Results and Selected */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Results Column */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Résultats de recherche</h3>
              <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 divide-y divide-gray-200">
                {results.map(c => (
                  <button 
                    type="button" 
                    key={c.id} 
                    onClick={() => addChar(c)}
                    disabled={submitting || selectedIds.includes(c.id)}
                    className="flex w-full items-center justify-between p-3 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed text-left"
                  >
                    <span className="truncate font-medium text-gray-900">{c.name}</span>
                    <span className="text-xs text-gray-500 ml-2">#{c.id}</span>
                  </button>
                ))}
                {!results.length && (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Aucun résultat trouvé
                  </div>
                )}
              </div>
            </div>

            {/* Selected Column */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Participants sélectionnés 
                <span className="text-xs text-gray-500 font-normal">(ordre = seed)</span>
              </h3>
              <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 divide-y divide-gray-200">
                {selected.map((c, idx) => (
                  <div key={c.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-center text-xs text-gray-500 font-mono bg-gray-100 rounded px-1 py-0.5">
                        #{idx + 1}
                      </span>
                      <span className="truncate font-medium text-gray-900">{c.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        type="button" 
                        onClick={() => moveUp(idx)}
                        disabled={submitting || idx === 0}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-black/60 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        ↑
                      </button>
                      <button 
                        type="button" 
                        onClick={() => moveDown(idx)}
                        disabled={submitting || idx === selected.length - 1}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-black/60 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        ↓
                      </button>
                      <button 
                        type="button" 
                        onClick={() => removeChar(c.id)}
                        disabled={submitting}
                        className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                ))}
                {!selected.length && (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Sélectionnez des personnages dans les résultats de recherche
                  </div>
                )}
              </div>
              {selected.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {selected.length} participant{selected.length > 1 ? 's' : ''} sélectionné{selected.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Actions */}
        <div className="rounded-2xl border bg-white shadow-sm p-4 md:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Actions</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center px-6 py-3 bg-black text-white rounded-lg hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-black/60 disabled:opacity-60 disabled:cursor-not-allowed font-medium"
            >
              {submitting && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {submitting ? 'Création en cours...' : 'Créer le tournoi'}
            </button>
            <a 
              href="/t" 
              className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/60 font-medium"
            >
              Annuler
            </a>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Assurez-vous que toutes les informations sont correctes avant de créer le tournoi.
          </p>
        </div>
      </form>
    </div>
  );
}

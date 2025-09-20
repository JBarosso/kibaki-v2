import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addUsedPair,
  clearUsedPairs,
  getAllCharacterIds,
  getUsedPairs,
  loadPairDetails,
  makePairHash,
  pickRandomDistinctPair,
  type CharacterRow,
  type DuelPair,
  SCOPE_KEY,
} from '@/lib/duels';
import CharacterCard from '@/components/CharacterCard';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabaseClient';
import { showToast } from '@/lib/toast';
import { fetchUniverses, type Universe } from '@/lib/top';
import { getRecentSeenPairs, markPairSeen } from '@/lib/seenPairs';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export default function DuelContainer() {
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [ids, setIds] = useState<number[]>([]);
  const [pair, setPair] = useState<DuelPair | null>(null);
  const [openLeft, setOpenLeft] = useState(false);
  const [openRight, setOpenRight] = useState(false);
  const [lastVote, setLastVote] = useState<'left' | 'right' | null>(null);
  const [rateLimitedAt, setRateLimitedAt] = useState<number | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [lastVoteAt, setLastVoteAt] = useState<number | null>(null);
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [scope, setScope] = useState<string>('global');
  const scopeRef = useRef<string>('global');

  const usedPairs = useMemo(() => getUsedPairs(scope), [scope]);

  // bootstrap
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setState('loading');
      setError(null);
      try {
        // Load universes and saved scope
        const [u] = await Promise.all([
          fetchUniverses(),
        ]);
        if (cancelled) return;
        setUniverses(u);

        // Load saved scope from LS
        let savedScope = 'global';
        try {
          if (typeof window !== 'undefined' && 'localStorage' in window) {
            const s = window.localStorage.getItem(SCOPE_KEY);
            if (s && typeof s === 'string') savedScope = s;
          }
        } catch {}
        setScope(savedScope);

        const fetchedIds = await getAllCharacterIds(savedScope);
        if (cancelled) return;
        setIds(fetchedIds);
        // Merge server-seen pairs (if logged-in) into local avoid set before first pick
        try {
          const server = await getRecentSeenPairs(500);
          server.forEach((k) => addUsedPair(k, savedScope));
        } catch {}
        if (fetchedIds.length >= 2) {
          await loadFreshPair(fetchedIds, getUsedPairs(savedScope));
        } else {
          setPair(null);
        }
        if (cancelled) return;
        setState('ready');
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? String(e));
        setState('error');
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // When scope changes (via UI), reload ids and reset pair memory for that scope
  useEffect(() => {
    scopeRef.current = scope;
    let cancelled = false;
    const run = async () => {
      // Skip first pass if state is still idle/loading from init; init handles first fetch
      if (state === 'idle') return;
      setState('loading');
      setError(null);
      try {
        // Persist scope
        try {
          if (typeof window !== 'undefined' && 'localStorage' in window) {
            window.localStorage.setItem(SCOPE_KEY, scope);
          }
        } catch {}

        // Reset pair memory only for the selected scope
        clearUsedPairs(scope);
        setPair(null);

        const fetchedIds = await getAllCharacterIds(scope, true);
        if (cancelled) return;
        setIds(fetchedIds);

        // Merge server-seen pairs (if logged-in) for this scope before next pick
        try {
          const server = await getRecentSeenPairs(500);
          server.forEach((k) => addUsedPair(k, scope));
        } catch {}

        if (fetchedIds.length >= 2) {
          await loadFreshPair(fetchedIds, getUsedPairs(scope));
        } else {
          setPair(null);
        }
        if (cancelled) return;
        setState('ready');
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? String(e));
        setState('error');
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  // When user logs in during the session, merge server-seen pairs into current scope
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        try {
          const server = await getRecentSeenPairs(500);
          const currentScope = scopeRef.current;
          server.forEach((k) => addUsedPair(k, currentScope));
        } catch {}
      }
    });
    return () => {
      listener.subscription.unsubscribe();
    };
    // We intentionally don't include scope to avoid re-subscribing; scope value is captured
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFreshPair = async (allIds: number[], avoid: Set<string>) => {
    if (!Array.isArray(allIds) || allIds.length < 2) {
      setPair(null);
      return;
    }
    const [leftId, rightId, hash] = pickRandomDistinctPair(allIds, avoid);
    const { left, right } = await loadPairDetails(leftId, rightId);
    setPair({ left, right, hash });
  };

  const postVote = async (winnerId: number, loserId: number) => {
    const nonce = crypto.randomUUID();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    const url = `${import.meta.env.PUBLIC_SUPABASE_URL}/functions/v1/vote`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ winner_id: winnerId, loser_id: loserId, nonce }),
    })
      .then(async (r) => {
        const j: any = await r.json().catch(() => ({}));
        if (!r.ok && j?.reason === 'rate_limited') {
          // show a soft banner for a few seconds
          // you can implement: setRateLimitedAt(Date.now())
          setRateLimitedAt(Date.now());
          showToast({ type: 'error', message: 'Trop de votes, réessayez dans un instant.' });
        } else if (!r.ok) {
          showToast({ type: 'error', message: 'Une erreur est survenue lors du vote.' });
        } else {
          showToast({ type: 'info', message: 'Vote pris en compte' });
        }
      })
      .catch((err) => {
        console.warn('vote error', err);
        showToast({ type: 'error', message: 'Impossible d\'envoyer votre vote.' });
      });
  };

  const vote = async (side: 'left' | 'right') => {
    if (!pair) return;
    if (isVoting) return; // ignore if already voting
    const now = Date.now();
    if (now - (lastVoteAt ?? 0) < 700) return; // throttle rapid clicks

    const currentPair = pair;
    const winnerId = side === 'left' ? currentPair.left.id : currentPair.right.id;
    const loserId = side === 'left' ? currentPair.right.id : currentPair.left.id;

    setIsVoting(true);
    try {
      await postVote(winnerId, loserId);
      setLastVoteAt(Date.now());
      addUsedPair(currentPair.hash, scope);
      // Fire-and-forget server write for logged-in users
      try { void markPairSeen(currentPair.hash).catch(() => {}); } catch {}
      setLastVote(side);
      await loadFreshPair(ids, getUsedPairs(scope));
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setState('error');
    } finally {
      setIsVoting(false);
    }
  };

  const skip = async () => {
    if (!pair) return;
    addUsedPair(pair.hash, scope);
    // Fire-and-forget server write for logged-in users
    try { void markPairSeen(pair.hash).catch(() => {}); } catch {}
    try {
      await loadFreshPair(ids, getUsedPairs(scope));
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setState('error');
    }
  };

  const resetPairs = async () => {
    clearUsedPairs(scope);
    try {
      await loadFreshPair(ids, getUsedPairs(scope));
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setState('error');
    }
  };

  if (state === 'loading' || state === 'idle') {
    return (
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="mb-4 h-6 w-40 rounded bg-gray-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="h-80 rounded-2xl bg-gray-200" />
          <div className="h-80 rounded-2xl bg-gray-200" />
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="rounded-2xl border bg-white p-6 text-sm text-red-600">
        {error ?? 'An error occurred.'}
      </div>
    );
  }

  if (ids.length < 2) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ScopeSelector universes={universes} value={scope} onChange={setScope} />
        </div>
        <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
          Pas assez de personnages dans cet univers pour lancer un duel.
        </div>
      </div>
    );
  }

  if (!pair) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ScopeSelector universes={universes} value={scope} onChange={(s) => setScope(s)} />
        </div>
        <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
          Chargement d'une paire...
        </div>
      </div>
    );
  }

  const { left, right, hash } = pair;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ScopeSelector universes={universes} value={scope} onChange={(s) => setScope(s)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col">
          <CharacterCard character={left} side="left" onMore={() => setOpenLeft(true)} />
          <button
            onClick={() => vote('left')}
            disabled={isVoting}
            className="mt-3 rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Voter à gauche
          </button>
        </div>

        <div className="flex flex-col">
          <CharacterCard character={right} side="right" onMore={() => setOpenRight(true)} />
          <button
            onClick={() => vote('right')}
            disabled={isVoting}
            className="mt-3 rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Voter à droite
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={skip} className="rounded border px-3 py-1.5">Passer</button>
        <button onClick={resetPairs} className="rounded border px-3 py-1.5">Réinitialiser les paires</button>
        {import.meta.env.DEV ? (
          <span className="text-xs text-gray-500">hash: {hash}</span>
        ) : null}
        {lastVote ? (
          <span className="ml-auto text-xs text-gray-500">Sauvegardé localement.</span>
        ) : null}
      </div>

      {/* Modals */}
      <Modal open={openLeft} onClose={() => setOpenLeft(false)} title={left.name}>
        <CharacterDetails character={left} />
      </Modal>
      <Modal open={openRight} onClose={() => setOpenRight(false)} title={right.name}>
        <CharacterDetails character={right} />
      </Modal>
    </div>
  );
}

function CharacterDetails({ character }: { character: CharacterRow }) {
  return (
    <div className="space-y-2 text-sm text-gray-700">
      <div className="text-gray-900">ELO: <strong>{character.elo}</strong></div>
      <div>Wins: <strong>{character.wins}</strong></div>
      <div>Losses: <strong>{character.losses}</strong></div>
      {character.description ? (
        <p className="pt-2 text-gray-700">{character.description}</p>
      ) : (
        <p className="pt-2 text-gray-400">No description.</p>
      )}
    </div>
  );
}

function ScopeSelector({ universes, value, onChange }: { universes: Universe[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">Univers:</label>
      <select
        className="rounded border px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="global">Global</option>
        {universes.map((u) => (
          <option key={u.id} value={u.slug}>{u.name}</option>
        ))}
      </select>
    </div>
  );
}



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

// Optimistic vote state types
type OptimisticVoteState = {
  winnerId: number | null;
  status: 'idle' | 'pending' | 'success' | 'error';
};

// Debug mode for testing scenarios
const DEBUG_MODE = import.meta.env.DEV;

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

  // Optimistic UI states
  const [optimisticVote, setOptimisticVote] = useState<OptimisticVoteState>({
    winnerId: null,
    status: 'idle'
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [scope, setScope] = useState<string>('global');
  const scopeRef = useRef<string>('global');
  const mountedRef = useRef<boolean>(false);
  const bootstrappedRef = useRef<boolean>(false);

  const usedPairs = useMemo(() => getUsedPairs(scope), [scope]);

  // bootstrap
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    mountedRef.current = true;

    (async () => {
      setState('loading');
      setError(null);
      try {
        // Load universes
        const u = await fetchUniverses();
        if (!mountedRef.current) return;
        setUniverses(u);

        // Load saved scope from LS
        let savedScope = 'global';
        try {
          if (typeof window !== 'undefined' && 'localStorage' in window) {
            const s = window.localStorage.getItem(SCOPE_KEY);
            if (s && typeof s === 'string') savedScope = s;
          }
        } catch {}
        if (!mountedRef.current) return;
        setScope(savedScope);

        // Fetch ids for scope
        const fetchedIds = await getAllCharacterIds(savedScope);
        if (!mountedRef.current) return;
        setIds(fetchedIds);

        // (A) Immediately load a local pair without waiting for any auth/server merge
        if (fetchedIds.length >= 2) {
          await loadFreshPair(fetchedIds, getUsedPairs(savedScope));
        } else {
          setPair(null);
        }
        if (!mountedRef.current) return;
        setState('ready');
      } catch (e: any) {
        if (!mountedRef.current) return;
        setError(e?.message ?? String(e));
        setState('error');
      }
    })();

    // (B) In parallel, non-blocking: merge server seen pairs if user is logged-in
    (async () => {
      try {
        const server = await getRecentSeenPairs(500);
        if (!mountedRef.current) return;
        const currentScope = scopeRef.current || 'global';
        server.forEach((k) => addUsedPair(k, currentScope));
      } catch {}
    })();

    return () => { mountedRef.current = false; };
  }, []);

  // When scope changes (via UI), reload ids and reset pair memory for that scope
  useEffect(() => {
    scopeRef.current = scope;
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
        if (!mountedRef.current) return;
        setIds(fetchedIds);

        // Immediately load a local pair for the new scope
        if (fetchedIds.length >= 2) {
          await loadFreshPair(fetchedIds, getUsedPairs(scope));
        } else {
          setPair(null);
        }

        setState('ready');
      } catch (e: any) {
        if (!mountedRef.current) return;
        setError(e?.message ?? String(e));
        setState('error');
      }
    };
    run();

    // Non-blocking merge of server-seen pairs for this scope
    (async () => {
      try {
        const server = await getRecentSeenPairs(500);
        if (!mountedRef.current) return;
        server.forEach((k) => addUsedPair(k, scope));
      } catch {}
    })();
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

    // Debug mode: simulate different scenarios
    if (DEBUG_MODE) {
      console.log('🔧 DEBUG: Vote initiated', { winnerId, loserId, nonce });

      // Check URL params for debug scenarios
      const urlParams = new URLSearchParams(window.location.search);
      const debugScenario = urlParams.get('debug');

      switch (debugScenario) {
        case 'rate-limit':
          console.log('🔧 DEBUG: Simulating rate limit');
          await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
          return { ok: false, reason: 'rate_limited', duplicate: false, result: {} };

        case 'server-error':
          console.log('🔧 DEBUG: Simulating server error');
          await new Promise(resolve => setTimeout(resolve, 500));
          return { ok: false, reason: 'server_error', duplicate: false, result: {} };

        case 'network-error':
          console.log('🔧 DEBUG: Simulating network error');
          await new Promise(resolve => setTimeout(resolve, 200));
          throw new Error('Network connection failed');

        case 'slow-network':
          console.log('🔧 DEBUG: Simulating slow network');
          await new Promise(resolve => setTimeout(resolve, 2000));
          break; // Continue to normal flow

        default:
          console.log('🔧 DEBUG: Normal flow - Add ?debug=rate-limit|server-error|network-error|slow-network to test scenarios');
      }
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    const url = `${import.meta.env.PUBLIC_SUPABASE_URL}/functions/v1/vote`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ winner_id: winnerId, loser_id: loserId, nonce }),
    });

    const result: any = await response.json().catch(() => ({}));

    if (DEBUG_MODE) {
      console.log('🔧 DEBUG: Vote response', { ok: response.ok, result });
    }

    return {
      ok: response.ok,
      reason: result?.reason,
      duplicate: result?.duplicate,
      result
    };
  };

  const vote = async (side: 'left' | 'right') => {
    if (!pair) return;
    if (isVoting || isTransitioning) return; // ignore if already voting or transitioning
    const now = Date.now();
    if (now - (lastVoteAt ?? 0) < 700) return; // throttle rapid clicks

    const currentPair = pair;
    const winnerId = side === 'left' ? currentPair.left.id : currentPair.right.id;
    const loserId = side === 'left' ? currentPair.right.id : currentPair.left.id;

    // Optimistic UI: Immediate visual feedback
    setOptimisticVote({ winnerId, status: 'pending' });
    setIsTransitioning(true);
    setIsVoting(true);

    try {
      // API call in background
      const voteResult = await postVote(winnerId, loserId);

      if (!voteResult.ok && voteResult.reason === 'rate_limited') {
        // Rollback with shake animation
        setOptimisticVote({ winnerId, status: 'error' });
        setRateLimitedAt(Date.now());
        showToast({ type: 'error', message: 'Trop de votes, réessayez dans un instant.' });
        // Reset UI state after shake animation
        setTimeout(() => {
          setOptimisticVote({ winnerId: null, status: 'idle' });
          setIsTransitioning(false);
          setIsVoting(false);
        }, 600);
        return;
      } else if (!voteResult.ok) {
        // Network/server error - rollback
        setOptimisticVote({ winnerId, status: 'error' });
        showToast({ type: 'error', message: 'Une erreur est survenue lors du vote.' });
        setTimeout(() => {
          setOptimisticVote({ winnerId: null, status: 'idle' });
          setIsTransitioning(false);
          setIsVoting(false);
        }, 600);
        return;
      } else {
        // Success path
        setOptimisticVote({ winnerId, status: 'success' });
        showToast({ type: 'info', message: 'Vote pris en compte' });

        // Update state and load next duel during success animation
        setLastVoteAt(Date.now());
        addUsedPair(currentPair.hash, scope);
        try { void markPairSeen(currentPair.hash).catch(() => {}); } catch {}
        setLastVote(side);

        // Load next duel after brief success animation
        setTimeout(async () => {
          await loadFreshPair(ids, getUsedPairs(scope));
          setOptimisticVote({ winnerId: null, status: 'idle' });
          setIsTransitioning(false);
          setIsVoting(false);
        }, 400);
      }
    } catch (e: any) {
      // Network error - rollback
      setOptimisticVote({ winnerId, status: 'error' });
      showToast({ type: 'error', message: 'Impossible d\'envoyer votre vote.' });
      setTimeout(() => {
        setOptimisticVote({ winnerId: null, status: 'idle' });
        setIsTransitioning(false);
        setIsVoting(false);
      }, 600);
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

  // Animation classes for character cards
  const getCardAnimationClasses = (characterId: number) => {
    if (optimisticVote.winnerId === characterId) {
      switch (optimisticVote.status) {
        case 'pending':
          return 'transform transition-all duration-300 scale-105 ring-4 ring-green-500 ring-opacity-50 animate-pulse';
        case 'success':
          return 'transform transition-all duration-300 scale-105 ring-4 ring-green-500 ring-opacity-75';
        case 'error':
          return 'transform transition-all duration-300 animate-shake ring-4 ring-red-500 ring-opacity-50';
        default:
          return '';
      }
    } else if (optimisticVote.winnerId && optimisticVote.winnerId !== characterId && optimisticVote.status === 'pending') {
      return 'opacity-50 scale-95 transition-all duration-300';
    }
    return '';
  };

  // Button classes for animation states
  const getButtonClasses = (characterId: number, baseClasses: string) => {
    const disabled = isVoting || isTransitioning;
    const isWinner = optimisticVote.winnerId === characterId;

    let classes = baseClasses;

    if (disabled) {
      classes += ' cursor-not-allowed opacity-50';
    } else {
      classes += ' hover:scale-105';
    }

    if (isWinner && optimisticVote.status === 'success') {
      classes += ' bg-green-600';
    } else if (isWinner && optimisticVote.status === 'error') {
      classes += ' bg-red-600';
    }

    classes += ' transition-all duration-200';

    return classes;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ScopeSelector universes={universes} value={scope} onChange={(s) => setScope(s)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col">
          <CharacterCard
            character={left}
            side="left"
            onMore={() => setOpenLeft(true)}
            className={getCardAnimationClasses(left.id)}
          />
          <button
            onClick={() => vote('left')}
            disabled={isVoting || isTransitioning}
            className={getButtonClasses(left.id, "mt-3 rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed")}
          >
            Voter à gauche
          </button>
        </div>

        <div className="flex flex-col">
          <CharacterCard
            character={right}
            side="right"
            onMore={() => setOpenRight(true)}
            className={getCardAnimationClasses(right.id)}
          />
          <button
            onClick={() => vote('right')}
            disabled={isVoting || isTransitioning}
            className={getButtonClasses(right.id, "mt-3 rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed")}
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



import React, { useEffect, useMemo, useState } from 'react';
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
} from '@/lib/duels';
import CharacterCard from '@/components/CharacterCard';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabaseClient';

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

  const usedPairs = useMemo(() => getUsedPairs(), []);

  // bootstrap
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setState('loading');
      setError(null);
      try {
        const fetchedIds = await getAllCharacterIds();
        if (cancelled) return;
        setIds(fetchedIds);
        await loadFreshPair(fetchedIds, usedPairs);
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
        }
      })
      .catch((err) => console.warn('vote error', err));
  };

  const vote = async (side: 'left' | 'right') => {
    if (!pair) return;
    const currentPair = pair;
    const winnerId = side === 'left' ? currentPair.left.id : currentPair.right.id;
    const loserId = side === 'left' ? currentPair.right.id : currentPair.left.id;
    // Fire-and-forget: do not block optimistic UI
    void postVote(winnerId, loserId);
    addUsedPair(pair.hash);
    setLastVote(side);
    // Optimistic: load next pair immediately
    try {
      await loadFreshPair(ids, getUsedPairs());
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setState('error');
    }
  };

  const skip = async () => {
    if (!pair) return;
    addUsedPair(pair.hash);
    try {
      await loadFreshPair(ids, getUsedPairs());
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setState('error');
    }
  };

  const resetPairs = async () => {
    clearUsedPairs();
    try {
      await loadFreshPair(ids, getUsedPairs());
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

  if (!pair || ids.length < 2) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
        Not enough characters to run a duel. Please add more.
      </div>
    );
  }

  const { left, right, hash } = pair;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col">
          <CharacterCard character={left} side="left" onMore={() => setOpenLeft(true)} />
          <button
            onClick={() => vote('left')}
            className="mt-3 rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90"
          >
            Vote Left
          </button>
        </div>

        <div className="flex flex-col">
          <CharacterCard character={right} side="right" onMore={() => setOpenRight(true)} />
          <button
            onClick={() => vote('right')}
            className="mt-3 rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90"
          >
            Vote Right
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={skip} className="rounded border px-3 py-1.5">Skip</button>
        <button onClick={resetPairs} className="rounded border px-3 py-1.5">Reset pairs</button>
        {import.meta.env.DEV ? (
          <span className="text-xs text-gray-500">hash: {hash}</span>
        ) : null}
        {lastVote ? (
          <span className="ml-auto text-xs text-gray-500">Saved locally; server vote will be wired in Step 4</span>
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



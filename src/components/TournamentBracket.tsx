import React from 'react';
import type { TMatch } from '@/lib/tournaments';

type Props = {
  matches: TMatch[];
  onVote?: (m: TMatch, choiceId: number) => void;
  now?: number; // Date.now()
  characterNameById?: (id: number | null) => string;
};

export default function TournamentBracket({ matches, onVote, now = Date.now(), characterNameById }: Props) {
  const rounds = new Map<number, TMatch[]>();
  for (const m of matches) {
    if (!rounds.has(m.round)) rounds.set(m.round, []);
    rounds.get(m.round)!.push(m);
  }
  const sortedRounds = Array.from(rounds.keys()).sort((a,b)=>a-b);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {sortedRounds.map((r) => {
        const ms = rounds.get(r)!.sort((a,b)=>a.match_number-b.match_number);
        return (
          <div key={r} className="space-y-3">
            <div className="text-sm font-semibold text-gray-700">Round {r}</div>
            {ms.map(m => {
              const open = new Date(m.opens_at).getTime() <= now;
              const closed = new Date(m.closes_at).getTime() <= now || m.status === 'closed';
              const c1 = characterNameById?.(m.char1_id ?? null) ?? (m.char1_id ?? '—').toString();
              const c2 = characterNameById?.(m.char2_id ?? null) ?? (m.char2_id ?? '—').toString();
              const canVote = Boolean(onVote && open && !closed && m.char1_id && m.char2_id);
              return (
                <div key={m.id} className="rounded-2xl border bg-white p-3 shadow-sm">
                  <div className="text-xs text-gray-500">
                    #{m.match_number} • {new Date(m.opens_at).toLocaleString()} → {new Date(m.closes_at).toLocaleString()}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <div className="truncate">{c1}</div>
                      <div className="truncate">{c2}</div>
                    </div>
                    {canVote ? (
                      <div className="flex gap-2">
                        <button className="rounded bg-black px-2 py-1 text-white text-xs" onClick={()=>onVote!(m, m.char1_id!)}>{c1}</button>
                        <button className="rounded bg-black px-2 py-1 text-white text-xs" onClick={()=>onVote!(m, m.char2_id!)}>{c2}</button>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">
                        {closed ? (m.winner_id ? `Winner: ${characterNameById?.(m.winner_id) ?? m.winner_id}` : 'Closed') : (open ? 'Open' : 'Scheduled')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

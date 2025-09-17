import React from 'react';
import type { UserVote, LiteCharacter } from '@/lib/userVotes';

function formatRelativeTime(iso: string): string {
  try {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const abs = Math.abs(diffMs);
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
      ['year', 1000 * 60 * 60 * 24 * 365],
      ['month', 1000 * 60 * 60 * 24 * 30],
      ['week', 1000 * 60 * 60 * 24 * 7],
      ['day', 1000 * 60 * 60 * 24],
      ['hour', 1000 * 60 * 60],
      ['minute', 1000 * 60],
      ['second', 1000],
    ];
    for (const [unit, ms] of units) {
      const amount = Math.round(abs / ms);
      if (amount >= (unit === 'second' ? 10 : 1)) {
        const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
        return rtf.format(Math.sign(-diffMs) * amount, unit);
      }
    }
    return date.toLocaleString();
  } catch {
    try { return new Date(iso).toLocaleString(); } catch { return String(iso); }
  }
}

function Avatar({ character }: { character: LiteCharacter }) {
  const { image_url, name } = character;
  if (image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image_url}
        alt={name}
        loading="lazy"
        className="h-10 w-10 shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-100 text-gray-400 grid place-items-center text-xs">
      N/A
    </div>
  );
}

function MiniCard({ character }: { character: LiteCharacter }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm">
      <Avatar character={character} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-gray-900" title={character.name}>{character.name}</div>
        <div className="text-xs text-gray-500">ELO: <span className="font-medium text-gray-700">{character.elo}</span></div>
      </div>
    </div>
  );
}

export default function UserVoteItem({ vote }: { vote: UserVote }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <MiniCard character={vote.winner} />
        <div className="text-xs sm:text-sm text-gray-500 px-1 select-none">defeated</div>
        <MiniCard character={vote.loser} />
      </div>
      <div className="text-[11px] sm:text-xs text-gray-400">{formatRelativeTime(vote.created_at)}</div>
    </div>
  );
}



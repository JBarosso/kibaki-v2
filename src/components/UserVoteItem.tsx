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
        className="user-vote-item__avatar"
      />
    );
  }
  return (
    <div className="user-vote-item__avatar user-vote-item__avatar--placeholder">
      N/A
    </div>
  );
}

function MiniCard({ character }: { character: LiteCharacter }) {
  return (
    <div className="user-vote-item__card">
      <Avatar character={character} />
      <div className="user-vote-item__content">
        <div className="user-vote-item__name" title={character.name}>{character.name}</div>
        <div className="user-vote-item__elo">ELO: <span className="user-vote-item__elo-value">{character.elo}</span></div>
      </div>
    </div>
  );
}

export default function UserVoteItem({ vote }: { vote: UserVote }) {
  return (
    <div className="user-vote-item">
      <div className="user-vote-item__comparison">
        <MiniCard character={vote.winner} />
        <div className="user-vote-item__vs">defeated</div>
        <MiniCard character={vote.loser} />
      </div>
      <div className="user-vote-item__timestamp">{formatRelativeTime(vote.created_at)}</div>
    </div>
  );
}



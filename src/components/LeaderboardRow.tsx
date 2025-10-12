import React from 'react';
import type { TopCharacter } from '@/lib/top';
import { useI18n } from '@/i18n';

export default function LeaderboardRow({ rank, c }: { rank: number; c: TopCharacter }) {
  const { getCharacterText, getUniverseLabel } = useI18n();
  const characterView = getCharacterText({ slug: c.slug, name: c.name, description: undefined });
  const universeLabel = getUniverseLabel(c.universe.slug);

  return (
    <div className="leaderboard-row">
      <div className="leaderboard-row__rank">#{rank}</div>

      {rank <= 10 ? (
        c.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.image_url}
            alt={characterView.name}
            loading="lazy"
            className="leaderboard-row__avatar"
          />
        ) : (
          <div className="leaderboard-row__avatar leaderboard-row__avatar--placeholder" />
        )
      ) : (
        <div className="leaderboard-row__avatar leaderboard-row__avatar--hidden" />
      )}

      <div className="leaderboard-row__content">
        <div className="leaderboard-row__header">
          <div className="leaderboard-row__name" title={characterView.name}>
            {characterView.name}
          </div>
          <span className="leaderboard-row__universe" title={universeLabel}>
            {universeLabel}
          </span>
        </div>
      </div>

      <div className="leaderboard-row__stats">
        <div className="leaderboard-row__elo">ELO {c.elo}</div>
        <div className="leaderboard-row__record">W-L {c.wins}-{c.losses}</div>
      </div>
    </div>
  );
}

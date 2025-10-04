import React from 'react';
import type { TopCharacter } from '@/lib/top';
import { useI18n } from '@/i18n';

export default function LeaderboardRow({ rank, c }: { rank: number; c: TopCharacter }) {
  const { getCharacterText, getUniverseLabel } = useI18n();
  const characterView = getCharacterText({ slug: c.slug, name: c.name, description: undefined });
  const universeLabel = getUniverseLabel(c.universe.slug);

  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm">
      <div className="w-8 shrink-0 text-center text-sm font-semibold text-gray-700">#{rank}</div>

      {rank <= 10 ? (
        c.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.image_url}
            alt={characterView.name}
            loading="lazy"
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-full bg-gray-200" />
        )
      ) : (
        <div className="h-12 w-12 shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate text-sm font-medium text-gray-900" title={characterView.name}>
            {characterView.name}
          </div>
          <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600" title={universeLabel}>
            {universeLabel}
          </span>
        </div>
      </div>

      <div className="ml-auto text-right">
        <div className="font-mono text-xs text-gray-700">ELO {c.elo}</div>
        <div className="font-mono text-[11px] text-gray-500">W-L {c.wins}-{c.losses}</div>
      </div>
    </div>
  );
}

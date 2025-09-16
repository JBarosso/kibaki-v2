import React from 'react';
import type { CharacterRow } from '@/lib/duels';

export type CharacterCardProps = {
  character: CharacterRow;
  side: 'left' | 'right';
  onMore?: () => void;
};

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

export default function CharacterCard({ character, side, onMore }: CharacterCardProps) {
  const { name, description, image_url, elo, wins, losses } = character;

  return (
    <div className="flex h-full flex-col rounded-2xl border bg-white shadow-sm">
      {image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image_url}
          alt={name}
          className={`h-56 w-full rounded-t-2xl object-cover ${side === 'left' ? 'object-[center_left]' : 'object-[center_right]'}`}
          loading="lazy"
        />
      ) : (
        <div className="h-56 w-full rounded-t-2xl bg-gray-100" />
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="truncate text-lg font-semibold text-gray-900" title={name}>{name}</h3>
          <div className="text-xs text-gray-500">ELO: <span className="font-medium text-gray-700">{elo}</span></div>
        </div>
        <div className="mb-2 text-xs text-gray-500">W‑L: <span className="font-medium text-gray-700">{wins}</span>‑<span className="font-medium text-gray-700">{losses}</span></div>

        {description ? (
          <p className="mb-3 text-sm text-gray-700">{truncate(description, 120)}</p>
        ) : (
          <p className="mb-3 text-sm text-gray-400">No description.</p>
        )}

        <div className="mt-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onMore}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            More
          </button>
        </div>
      </div>
    </div>
  );
}



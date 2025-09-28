import React from 'react';
import type { CharacterRow } from '@/lib/duels';

export type CharacterCardProps = {
  character: CharacterRow;
  side: 'left' | 'right';
  onMore?: () => void;
  className?: string;
};

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

export default function CharacterCard({ character, side, onMore, className }: CharacterCardProps) {
  const { name, description, image_url, elo, wins, losses } = character;

  return (
    <div className={`flex h-full flex-col rounded-2xl border bg-white shadow-sm ${className || ''}`}>
      <div className="flex items-center justify-center p-4">
        {image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image_url}
            alt={name}
            className="w-32 h-32 object-cover rounded-xl"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            width={128}
            height={128}
            sizes="(max-width: 640px) 33vw, 128px"
          />
        ) : (
          <div className="w-32 h-32 rounded-xl bg-gray-100" />
        )}
      </div>

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



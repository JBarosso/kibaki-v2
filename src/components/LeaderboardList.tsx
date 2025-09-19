import React from 'react';
import type { TopCharacter } from '@/lib/top';
import LeaderboardRow from '@/components/LeaderboardRow';

export default function LeaderboardList({ items, rankMap }: { items: TopCharacter[]; rankMap?: Map<number, number> }) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-center text-sm text-gray-600">
        No characters match your filters.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const absRank = rankMap?.get(item.id) ?? idx + 1;
        return <LeaderboardRow key={item.id} rank={absRank} c={item} />;
      })}
    </div>
  );
}



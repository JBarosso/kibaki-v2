import React from 'react';
import type { TopCharacter } from '@/lib/top';
import LeaderboardRow from '@/components/LeaderboardRow';
import { useI18n } from '@/i18n';

export default function LeaderboardList({ items, rankMap }: { items: TopCharacter[]; rankMap?: Map<number, number> }) {
  const { t } = useI18n();
  if (!items || items.length === 0) {
    return (
      <div className="leaderboard-list leaderboard-list--empty">
        {t('top.empty')}
      </div>
    );
  }

  return (
    <div className="leaderboard-list">
      {items.map((item, idx) => {
        const absRank = rankMap?.get(item.id) ?? idx + 1;
        return <LeaderboardRow key={item.id} rank={absRank} c={item} />;
      })}
    </div>
  );
}



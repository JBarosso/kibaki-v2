import React from 'react';
import type { CharacterRow } from '@/lib/duels';
import { useI18n } from '@/i18n';

export type CharacterCardProps = {
  character: CharacterRow;
  side: 'left' | 'right';
  onMore?: () => void;
  className?: string;
  display?: {
    name: string;
    description?: string;
  };
};

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

export default function CharacterCard({ character, side, onMore, className, display }: CharacterCardProps) {
  const { t } = useI18n();
  const { name, description, image_url, elo, wins, losses } = character;
  const displayName = display?.name ?? name;
  const displayDescription = display?.description ?? description ?? undefined;

  return (
    <div className={`character-card ${className || ''}`}>
      <div className="character-card__image-wrapper">
        {image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image_url}
            alt={displayName}
            className="character-card__image"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            width={128}
            height={128}
            sizes="(max-width: 640px) 33vw, 128px"
          />
        ) : (
          <div className="character-card__image-placeholder" />
        )}
      </div>

      <div className="character-card__content">
        <div className="character-card__header">
          <h3 className="character-card__name" title={displayName}>{displayName}</h3>
          <div className="character-card__elo">ELO: <span className="character-card__elo-value">{elo}</span></div>
        </div>
        <div className="character-card__stats">W‑L: <span className="character-card__stats-value">{wins}</span>‑<span className="character-card__stats-value">{losses}</span></div>

        {displayDescription ? (
          <p className="character-card__description">{truncate(displayDescription, 120)}</p>
        ) : (
          <p className="character-card__description character-card__description--empty">{t('duel.noDescription')}</p>
        )}

        <div className="character-card__footer">
          <button
            type="button"
            onClick={onMore}
            className="character-card__more-button"
          >
            {t('duel.more')}
          </button>
        </div>
      </div>
    </div>
  );
}



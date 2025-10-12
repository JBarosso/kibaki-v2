import React from 'react';
import { getPrefersReducedMotion, animationClasses } from '@/lib/animations';

export interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  const reducedMotion = getPrefersReducedMotion();

  // Use static skeleton for reduced motion users
  const skeletonClass = reducedMotion ? animationClasses.skeleton : animationClasses.skeletonAnimated;

  return (
    <div className={`skeleton-card ${className || ''}`}>
      {/* Character image skeleton */}
      <div className="skeleton-card__image-wrapper">
        <div className={`skeleton-card__image ${skeletonClass}`} />
      </div>

      <div className="skeleton-card__content">
        {/* Character name and ELO skeleton */}
        <div className="skeleton-card__header">
          <div className={`skeleton-card__name ${skeletonClass}`} />
          <div className={`skeleton-card__elo ${skeletonClass}`} />
        </div>

        {/* Win-Loss record skeleton */}
        <div className={`skeleton-card__stats ${skeletonClass}`} />

        {/* Description skeleton */}
        <div className="skeleton-card__description">
          <div className={`skeleton-card__description-line ${skeletonClass}`} />
          <div className={`skeleton-card__description-line ${skeletonClass}`} />
          <div className={`skeleton-card__description-line ${skeletonClass}`} />
        </div>

        {/* More button skeleton */}
        <div className="skeleton-card__footer">
          <div className={`skeleton-card__more ${skeletonClass}`} />
        </div>
      </div>
    </div>
  );
}

export interface SkeletonDuelProps {
  className?: string;
}

export function SkeletonDuel({ className }: SkeletonDuelProps) {
  const reducedMotion = getPrefersReducedMotion();
  const skeletonClass = reducedMotion ? animationClasses.skeleton : animationClasses.skeletonAnimated;

  return (
    <div className={`skeleton-duel ${className || ''}`}>
      {/* Scope selector skeleton */}
      <div className="skeleton-duel__scope">
        <div className={`skeleton-duel__scope-label ${skeletonClass}`} />
        <div className={`skeleton-duel__scope-select ${skeletonClass}`} />
      </div>

      {/* Character cards skeleton */}
      <div className="skeleton-duel__cards-grid">
        <div className="skeleton-duel__card-column">
          <SkeletonCard />
          <div className={`skeleton-duel__button ${skeletonClass}`} />
        </div>

        <div className="skeleton-duel__card-column">
          <SkeletonCard />
          <div className={`skeleton-duel__button ${skeletonClass}`} />
        </div>
      </div>

      {/* Action buttons skeleton */}
      <div className="skeleton-duel__actions">
        <div className={`skeleton-duel__action-button ${skeletonClass}`} />
        <div className={`skeleton-duel__action-button ${skeletonClass}`} />
      </div>
    </div>
  );
}

export interface SkeletonListProps {
  count?: number;
  className?: string;
}

export function SkeletonList({ count = 5, className }: SkeletonListProps) {
  const reducedMotion = getPrefersReducedMotion();
  const skeletonClass = reducedMotion ? animationClasses.skeleton : animationClasses.skeletonAnimated;

  return (
    <div className={`skeleton-list ${className || ''}`}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton-list__item">
          {/* Avatar skeleton */}
          <div className={`skeleton-list__avatar ${skeletonClass}`} />

          {/* Content skeleton */}
          <div className="skeleton-list__content">
            <div className={`skeleton-list__title ${skeletonClass}`} />
            <div className={`skeleton-list__subtitle ${skeletonClass}`} />
          </div>

          {/* Action skeleton */}
          <div className={`skeleton-list__action ${skeletonClass}`} />
        </div>
      ))}
    </div>
  );
}

export interface SkeletonButtonProps {
  className?: string;
}

export function SkeletonButton({ className }: SkeletonButtonProps) {
  const reducedMotion = getPrefersReducedMotion();
  const skeletonClass = reducedMotion ? animationClasses.skeleton : animationClasses.skeletonAnimated;

  return <div className={`skeleton-button ${skeletonClass} ${className || ''}`} />;
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  const reducedMotion = getPrefersReducedMotion();
  const skeletonClass = reducedMotion ? animationClasses.skeleton : animationClasses.skeletonAnimated;

  return (
    <div className={`skeleton-text ${className || ''}`}>
      {Array.from({ length: lines }, (_, index) => {
        return (
          <div
            key={index}
            className={`skeleton-text__line ${skeletonClass}`}
          />
        );
      })}
    </div>
  );
}
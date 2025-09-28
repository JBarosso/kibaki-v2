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
    <div className={`flex h-full flex-col rounded-2xl border bg-white shadow-sm ${className || ''}`}>
      {/* Character image skeleton */}
      <div className="flex items-center justify-center p-4">
        <div className={`w-32 h-32 rounded-xl ${skeletonClass}`} />
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* Character name and ELO skeleton */}
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className={`h-6 rounded w-24 ${skeletonClass}`} />
          <div className={`h-4 rounded w-16 ${skeletonClass}`} />
        </div>

        {/* Win-Loss record skeleton */}
        <div className={`mb-2 h-3 rounded w-20 ${skeletonClass}`} />

        {/* Description skeleton */}
        <div className="mb-3 space-y-2">
          <div className={`h-4 rounded w-full ${skeletonClass}`} />
          <div className={`h-4 rounded w-3/4 ${skeletonClass}`} />
          <div className={`h-4 rounded w-1/2 ${skeletonClass}`} />
        </div>

        {/* More button skeleton */}
        <div className="mt-auto flex items-center justify-between">
          <div className={`h-4 rounded w-12 ${skeletonClass}`} />
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
    <div className={`space-y-4 ${className || ''}`}>
      {/* Scope selector skeleton */}
      <div className="flex items-center gap-3">
        <div className={`h-4 rounded w-16 ${skeletonClass}`} />
        <div className={`h-8 rounded w-32 ${skeletonClass}`} />
      </div>

      {/* Character cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col">
          <SkeletonCard />
          <div className={`mt-3 h-10 rounded-lg ${skeletonClass}`} />
        </div>

        <div className="flex flex-col">
          <SkeletonCard />
          <div className={`mt-3 h-10 rounded-lg ${skeletonClass}`} />
        </div>
      </div>

      {/* Action buttons skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={`h-8 rounded w-16 ${skeletonClass}`} />
        <div className={`h-8 rounded w-40 ${skeletonClass}`} />
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
    <div className={`space-y-4 ${className || ''}`}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
          {/* Avatar skeleton */}
          <div className={`w-12 h-12 rounded-full ${skeletonClass}`} />

          {/* Content skeleton */}
          <div className="flex-1 space-y-2">
            <div className={`h-4 rounded w-1/3 ${skeletonClass}`} />
            <div className={`h-3 rounded w-1/2 ${skeletonClass}`} />
          </div>

          {/* Action skeleton */}
          <div className={`h-4 rounded w-16 ${skeletonClass}`} />
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

  return <div className={`h-10 rounded-lg ${skeletonClass} ${className || ''}`} />;
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  const reducedMotion = getPrefersReducedMotion();
  const skeletonClass = reducedMotion ? animationClasses.skeleton : animationClasses.skeletonAnimated;

  return (
    <div className={`space-y-2 ${className || ''}`}>
      {Array.from({ length: lines }, (_, index) => {
        // Vary the width for more natural appearance
        const widths = ['w-full', 'w-4/5', 'w-3/5', 'w-2/3', 'w-5/6'];
        const width = widths[index % widths.length];

        return (
          <div
            key={index}
            className={`h-4 rounded ${width} ${skeletonClass}`}
          />
        );
      })}
    </div>
  );
}
import React, { useEffect, useState } from 'react';
import { getPrefersReducedMotion, getAnimationDuration, animationClasses } from '@/lib/animations';

export interface ProgressBarProps {
  progress: number; // 0-100
  indeterminate?: boolean;
  className?: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  label?: string;
}

export function ProgressBar({
  progress,
  indeterminate = false,
  className = '',
  color = 'blue',
  size = 'md',
  showPercentage = false,
  label
}: ProgressBarProps) {
  const reducedMotion = getPrefersReducedMotion();
  const [displayProgress, setDisplayProgress] = useState(0);

  // Animate progress changes for better UX
  useEffect(() => {
    if (reducedMotion) {
      setDisplayProgress(progress);
      return;
    }

    const duration = getAnimationDuration('normal');
    const startProgress = displayProgress;
    const progressDiff = progress - startProgress;
    const startTime = Date.now();

    const animateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progressRatio = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOut = 1 - Math.pow(1 - progressRatio, 3);
      const currentProgress = startProgress + (progressDiff * easeOut);

      setDisplayProgress(currentProgress);

      if (progressRatio < 1) {
        requestAnimationFrame(animateProgress);
      }
    };

    requestAnimationFrame(animateProgress);
  }, [progress, reducedMotion, displayProgress]);

  const safeProgress = Math.max(0, Math.min(100, displayProgress));
  const progressStyle = !indeterminate ? { width: `${safeProgress}%` } : {};

  const barClass = `
    progress-bar__fill progress-bar__fill--${color} progress-bar--${size}
    ${reducedMotion ? '' : 'transition-all duration-300 ease-out'}
    ${indeterminate && !reducedMotion ? 'progress-bar__fill--indeterminate' : ''}
  `;

  return (
    <div className={`progress-bar ${className}`}>
      {/* Label and percentage */}
      {(label || showPercentage) && (
        <div className="progress-bar__header">
          {label && <span className="progress-bar__label">{label}</span>}
          {showPercentage && !indeterminate && (
            <span className="progress-bar__percentage">{Math.round(safeProgress)}%</span>
          )}
        </div>
      )}

      {/* Progress track */}
      <div className={`progress-bar__track progress-bar--${size}`}>
        {/* Progress fill */}
        <div
          className={barClass}
          style={progressStyle}
          role="progressbar"
          aria-valuenow={indeterminate ? undefined : Math.round(safeProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
    </div>
  );
}

export interface CircularProgressProps {
  progress: number; // 0-100
  size?: number; // Size in pixels
  strokeWidth?: number;
  color?: string;
  className?: string;
  showPercentage?: boolean;
  indeterminate?: boolean;
}

export function CircularProgress({
  progress,
  size = 40,
  strokeWidth = 4,
  color = '#3b82f6',
  className = '',
  showPercentage = false,
  indeterminate = false
}: CircularProgressProps) {
  const reducedMotion = getPrefersReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safeProgress = Math.max(0, Math.min(100, progress));
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg
        className={`${reducedMotion ? '' : 'transition-transform duration-300'} ${
          indeterminate && !reducedMotion ? 'animate-spin' : ''
        }`}
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={indeterminate ? circumference * 0.75 : strokeDashoffset}
          strokeLinecap="round"
          className={reducedMotion ? '' : 'transition-all duration-300 ease-out'}
        />
      </svg>

      {/* Percentage display */}
      {showPercentage && !indeterminate && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-gray-600">
            {Math.round(safeProgress)}%
          </span>
        </div>
      )}
    </div>
  );
}

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'red' | 'gray';
  className?: string;
}

export function LoadingSpinner({
  size = 'md',
  color = 'blue',
  className = ''
}: LoadingSpinnerProps) {
  const reducedMotion = getPrefersReducedMotion();

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const colorClasses = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    red: 'text-red-500',
    gray: 'text-gray-500'
  };

  if (reducedMotion) {
    // Static indicator for users who prefer reduced motion
    return (
      <div className={`${sizeClasses[size]} ${colorClasses[color]} ${className}`}>
        <div className="w-full h-full rounded-full border-2 border-current border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} ${colorClasses[color]} ${className}`}>
      <div className="w-full h-full rounded-full border-2 border-current border-t-transparent animate-spin" />
    </div>
  );
}

export interface LoadingDotsProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'red' | 'gray';
  className?: string;
}

export function LoadingDots({
  size = 'md',
  color = 'blue',
  className = ''
}: LoadingDotsProps) {
  const reducedMotion = getPrefersReducedMotion();

  const sizeClasses = {
    sm: 'w-1 h-1',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  };

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500'
  };

  const dotClass = `${sizeClasses[size]} ${colorClasses[color]} rounded-full`;

  if (reducedMotion) {
    return (
      <div className={`flex space-x-1 ${className}`}>
        <div className={dotClass} />
        <div className={dotClass} />
        <div className={dotClass} />
      </div>
    );
  }

  return (
    <div className={`flex space-x-1 ${className}`}>
      <div className={`${dotClass} animate-bounce`} style={{ animationDelay: '0ms' }} />
      <div className={`${dotClass} animate-bounce`} style={{ animationDelay: '150ms' }} />
      <div className={`${dotClass} animate-bounce`} style={{ animationDelay: '300ms' }} />
    </div>
  );
}

export interface ProgressStepsProps {
  steps: string[];
  currentStep: number;
  completedSteps?: number[];
  className?: string;
}

export function ProgressSteps({
  steps,
  currentStep,
  completedSteps = [],
  className = ''
}: ProgressStepsProps) {
  const reducedMotion = getPrefersReducedMotion();

  return (
    <div className={`space-y-4 ${className}`}>
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(index);
        const isCurrent = index === currentStep;
        const isPending = index > currentStep && !isCompleted;

        return (
          <div
            key={index}
            className={`flex items-center space-x-3 ${
              reducedMotion ? '' : 'transition-all duration-300'
            }`}
          >
            {/* Step indicator */}
            <div
              className={`
                flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }
                ${reducedMotion ? '' : 'transition-colors duration-300'}
              `}
            >
              {isCompleted ? '✓' : index + 1}
            </div>

            {/* Step label */}
            <span
              className={`
                ${isCurrent ? 'text-blue-600 font-medium' : ''}
                ${isCompleted ? 'text-green-600' : ''}
                ${isPending ? 'text-gray-500' : ''}
                ${reducedMotion ? '' : 'transition-colors duration-300'}
              `}
            >
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}
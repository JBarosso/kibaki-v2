import React, { useEffect, useState } from 'react';
import { getPrefersReducedMotion, getAnimationDuration } from '@/lib/animations';
import { Check } from 'lucide-react';

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

  const containerClassName = [
    'progress-bar',
    `progress-bar--${size}`,
    className
  ].filter(Boolean).join(' ').trim();

  const fillClasses = [
    'progress-bar__fill',
    `progress-bar__fill--${color}`
  ];

  if (!reducedMotion) {
    fillClasses.push('progress-bar__fill--animated');
  }

  if (indeterminate) {
    fillClasses.push('progress-bar__fill--indeterminate');
  }

  return (
    <div className={containerClassName}>
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
      <div className="progress-bar__track">
        {/* Progress fill */}
        <div
          className={fillClasses.join(' ')}
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

  const containerClassName = ['circular-progress', className].filter(Boolean).join(' ').trim();
  const svgClasses = ['circular-progress__svg'];

  if (!reducedMotion) {
    svgClasses.push('circular-progress__svg--animated');
  }

  if (indeterminate && !reducedMotion) {
    svgClasses.push('circular-progress__svg--spinning');
  }

  return (
    <div className={containerClassName} style={{ width: size, height: size }}>
      <svg
        className={svgClasses.join(' ')}
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background circle */}
        <circle
          className="circular-progress__background"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Progress circle */}
        <circle
          className={[
            'circular-progress__circle',
            !reducedMotion ? 'circular-progress__circle--animated' : '',
            indeterminate ? 'circular-progress__circle--indeterminate' : ''
          ].filter(Boolean).join(' ')}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={indeterminate ? circumference * 0.75 : strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>

      {/* Percentage display */}
      {showPercentage && !indeterminate && (
        <div className="circular-progress__percentage">
          <span>{Math.round(safeProgress)}%</span>
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

  const spinnerClassName = [
    'loading-spinner',
    `loading-spinner--${size}`,
    `loading-spinner--${color}`,
    className
  ].filter(Boolean).join(' ').trim();

  const ringClassName = [
    'loading-spinner__ring',
    !reducedMotion ? 'loading-spinner__ring--animated' : ''
  ].filter(Boolean).join(' ').trim();

  return (
    <div className={spinnerClassName}>
      <div className={ringClassName} />
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

  const containerClassName = [
    'loading-dots',
    `loading-dots--${size}`,
    `loading-dots--${color}`,
    className
  ].filter(Boolean).join(' ').trim();

  const baseDotClass = [
    'loading-dots__dot',
    !reducedMotion ? 'loading-dots__dot--animated' : ''
  ].filter(Boolean).join(' ').trim();

  return (
    <div className={containerClassName}>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={`${baseDotClass} loading-dots__dot--${index + 1}`}
          style={!reducedMotion ? { animationDelay: `${index * 150}ms` } : undefined}
        />
      ))}
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
  const containerClassName = ['progress-steps', className].filter(Boolean).join(' ').trim();

  return (
    <div className={containerClassName}>
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(index);
        const isCurrent = index === currentStep;
        const isPending = index > currentStep && !isCompleted;

        const stepClasses = [
          'progress-steps__step',
          !reducedMotion ? 'progress-steps__step--animated' : ''
        ].filter(Boolean).join(' ').trim();

        const indicatorClasses = ['progress-steps__indicator'];
        if (isCompleted) {
          indicatorClasses.push('progress-steps__indicator--completed');
        } else if (isCurrent) {
          indicatorClasses.push('progress-steps__indicator--current');
        } else if (isPending) {
          indicatorClasses.push('progress-steps__indicator--pending');
        }

        const labelClasses = ['progress-steps__label'];
        if (isCompleted) {
          labelClasses.push('progress-steps__label--completed');
        }
        if (isCurrent) {
          labelClasses.push('progress-steps__label--current');
        }
        if (isPending) {
          labelClasses.push('progress-steps__label--pending');
        }

        return (
          <div key={index} className={stepClasses}>
            {/* Step indicator */}
            <div className={indicatorClasses.join(' ')}>
              {isCompleted ? <Check size={16} /> : index + 1}
            </div>

            {/* Step label */}
            <span className={labelClasses.join(' ')}>
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}

import React, { useEffect, useState, useRef } from 'react';
import { getPrefersReducedMotion, getAnimationDuration, animationConfig } from '@/lib/animations';

export interface TransitionWrapperProps {
  show: boolean;
  children: React.ReactNode;
  duration?: keyof typeof animationConfig.durations;
  unmountOnExit?: boolean;
  className?: string;
  enter?: string;
  exit?: string;
  onEnter?: () => void;
  onExit?: () => void;
  onEntered?: () => void;
  onExited?: () => void;
}

export function TransitionWrapper({
  show,
  children,
  duration = 'normal',
  unmountOnExit = false,
  className = '',
  enter = 'opacity-100',
  exit = 'opacity-0',
  onEnter,
  onExit,
  onEntered,
  onExited
}: TransitionWrapperProps) {
  const [mounted, setMounted] = useState(show);
  const [isVisible, setIsVisible] = useState(show);
  const reducedMotion = getPrefersReducedMotion();
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const animationDuration = getAnimationDuration(duration);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (show) {
      if (!mounted) {
        setMounted(true);
      }

      // Small delay to ensure DOM is ready for transition
      if (!reducedMotion && animationDuration > 0) {
        timeoutRef.current = setTimeout(() => {
          setIsVisible(true);
          onEnter?.();

          // Call onEntered after animation completes
          timeoutRef.current = setTimeout(() => {
            onEntered?.();
          }, animationDuration);
        }, 10);
      } else {
        setIsVisible(true);
        onEnter?.();
        onEntered?.();
      }
    } else {
      setIsVisible(false);
      onExit?.();

      if (unmountOnExit && !reducedMotion && animationDuration > 0) {
        timeoutRef.current = setTimeout(() => {
          setMounted(false);
          onExited?.();
        }, animationDuration);
      } else if (unmountOnExit) {
        setMounted(false);
        onExited?.();
      } else {
        onExited?.();
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [show, unmountOnExit, reducedMotion, animationDuration, onEnter, onExit, onEntered, onExited, mounted]);

  if (!mounted && unmountOnExit) {
    return null;
  }

  const transitionStyle = reducedMotion || animationDuration === 0
    ? {}
    : {
        transition: `opacity ${animationDuration}ms ease-out, transform ${animationDuration}ms ease-out`,
        willChange: 'opacity, transform'
      };

  const visibilityClass = isVisible ? enter : exit;
  const pointerEvents = isVisible ? '' : 'pointer-events-none';

  return (
    <div
      className={`${className} ${visibilityClass} ${pointerEvents}`}
      style={transitionStyle}
    >
      {children}
    </div>
  );
}

export interface FadeTransitionProps {
  show: boolean;
  children: React.ReactNode;
  duration?: keyof typeof animationConfig.durations;
  unmountOnExit?: boolean;
  className?: string;
}

export function FadeTransition({
  show,
  children,
  duration = 'normal',
  unmountOnExit = false,
  className = ''
}: FadeTransitionProps) {
  return (
    <TransitionWrapper
      show={show}
      duration={duration}
      unmountOnExit={unmountOnExit}
      className={className}
      enter="opacity-100"
      exit="opacity-0"
    >
      {children}
    </TransitionWrapper>
  );
}

export interface SlideTransitionProps {
  show: boolean;
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  duration?: keyof typeof animationConfig.durations;
  unmountOnExit?: boolean;
  className?: string;
}

export function SlideTransition({
  show,
  children,
  direction = 'up',
  duration = 'normal',
  unmountOnExit = false,
  className = ''
}: SlideTransitionProps) {
  const transforms = {
    up: { enter: 'translate-y-0 opacity-100', exit: 'translate-y-4 opacity-0' },
    down: { enter: 'translate-y-0 opacity-100', exit: '-translate-y-4 opacity-0' },
    left: { enter: 'translate-x-0 opacity-100', exit: 'translate-x-4 opacity-0' },
    right: { enter: 'translate-x-0 opacity-100', exit: '-translate-x-4 opacity-0' }
  };

  const { enter, exit } = transforms[direction];

  return (
    <TransitionWrapper
      show={show}
      duration={duration}
      unmountOnExit={unmountOnExit}
      className={className}
      enter={enter}
      exit={exit}
    >
      {children}
    </TransitionWrapper>
  );
}

export interface ScaleTransitionProps {
  show: boolean;
  children: React.ReactNode;
  duration?: keyof typeof animationConfig.durations;
  unmountOnExit?: boolean;
  className?: string;
}

export function ScaleTransition({
  show,
  children,
  duration = 'normal',
  unmountOnExit = false,
  className = ''
}: ScaleTransitionProps) {
  return (
    <TransitionWrapper
      show={show}
      duration={duration}
      unmountOnExit={unmountOnExit}
      className={className}
      enter="scale-100 opacity-100"
      exit="scale-95 opacity-0"
    >
      {children}
    </TransitionWrapper>
  );
}

// Hook for managing complex transition states
export function useTransitionState(initialShow = false) {
  const [show, setShow] = useState(initialShow);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const toggle = () => setShow(prev => !prev);
  const open = () => setShow(true);
  const close = () => setShow(false);

  const handleEnter = () => setIsTransitioning(true);
  const handleEntered = () => setIsTransitioning(false);
  const handleExit = () => setIsTransitioning(true);
  const handleExited = () => setIsTransitioning(false);

  return {
    show,
    isTransitioning,
    toggle,
    open,
    close,
    transitionProps: {
      onEnter: handleEnter,
      onEntered: handleEntered,
      onExit: handleExit,
      onExited: handleExited
    }
  };
}

// Staggered children animations
export interface StaggeredTransitionProps {
  show: boolean;
  children: React.ReactNode[];
  staggerDelay?: number;
  duration?: keyof typeof animationConfig.durations;
  className?: string;
}

export function StaggeredTransition({
  show,
  children,
  staggerDelay = 50,
  duration = 'normal',
  className = ''
}: StaggeredTransitionProps) {
  const reducedMotion = getPrefersReducedMotion();
  const effectiveDelay = reducedMotion ? 0 : staggerDelay;

  return (
    <div className={className}>
      {children.map((child, index) => (
        <TransitionWrapper
          key={index}
          show={show}
          duration={duration}
          className="transition-all"
          enter="opacity-100 translate-y-0"
          exit="opacity-0 translate-y-2"
        >
          <div
            style={{
              transitionDelay: `${index * effectiveDelay}ms`
            }}
          >
            {child}
          </div>
        </TransitionWrapper>
      ))}
    </div>
  );
}
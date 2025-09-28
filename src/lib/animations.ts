// Animation configuration and utilities for functional animations only
export const animationConfig = {
  // Respect user preferences
  respectMotionPreference: true,

  // Duration presets (in ms)
  durations: {
    instant: 0,
    fast: 150,
    normal: 300,
    slow: 500
  },

  // Easing functions (GPU-accelerated)
  easings: {
    easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
  }
};

// Check if user prefers reduced motion
export function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    // Fallback for older browsers
    return false;
  }
}

// Get safe animation duration based on user preference
export function getAnimationDuration(type: keyof typeof animationConfig.durations): number {
  if (!animationConfig.respectMotionPreference) {
    return animationConfig.durations[type];
  }

  if (getPrefersReducedMotion()) {
    return animationConfig.durations.instant;
  }

  return animationConfig.durations[type];
}

// Get safe animation class based on user preference
export function getAnimationClass(animationClass: string, fallbackClass = ''): string {
  if (!animationConfig.respectMotionPreference) {
    return animationClass;
  }

  if (getPrefersReducedMotion()) {
    return fallbackClass;
  }

  return animationClass;
}

// CSS classes for functional animations
export const animationClasses = {
  // Skeleton loading (respects reduced motion)
  skeleton: 'bg-gray-200 dark:bg-gray-700',
  skeletonAnimated: 'animate-pulse bg-gray-200 dark:bg-gray-700',

  // State transitions
  fadeIn: 'transition-opacity duration-300 ease-out',
  fadeOut: 'transition-opacity duration-300 ease-out',
  slideUp: 'transition-transform duration-300 ease-out',

  // Loading states
  loading: 'opacity-50 pointer-events-none transition-opacity duration-200',

  // Error states
  error: 'ring-2 ring-red-500 ring-opacity-50 transition-all duration-200',

  // Success states
  success: 'ring-2 ring-green-500 ring-opacity-50 transition-all duration-200',

  // Focus states
  focusVisible: 'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-opacity-50',

  // Interactive states
  interactive: 'transition-transform duration-150 ease-out hover:scale-105 active:scale-95',

  // Smooth transitions for layout changes
  smooth: 'transition-all duration-300 ease-out'
};

// Performance monitoring utilities
export class AnimationPerformanceMonitor {
  private observer: PerformanceObserver | null = null;
  private frameCount = 0;
  private startTime = 0;
  private isMonitoring = false;

  startMonitoring() {
    if (typeof window === 'undefined' || !window.performance || this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.frameCount = 0;
    this.startTime = performance.now();

    // Monitor for long animation frames
    if ('PerformanceObserver' in window) {
      try {
        this.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 16.67) { // More than 1 frame at 60fps
              console.warn('🐌 Slow animation frame detected:', {
                duration: entry.duration.toFixed(2) + 'ms',
                name: entry.name,
                timestamp: entry.startTime
              });
            }
          }
        });

        this.observer.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('Performance monitoring not available:', error);
      }
    }

    // Monitor FPS
    this.measureFPS();
  }

  stopMonitoring() {
    this.isMonitoring = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private measureFPS() {
    if (!this.isMonitoring) return;

    this.frameCount++;
    const now = performance.now();

    if (now >= this.startTime + 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.startTime));

      if (fps < 55) {
        console.warn('🐌 Low FPS detected:', fps + ' fps');
      } else if (import.meta.env.DEV) {
        console.log('📊 FPS:', fps);
      }

      this.frameCount = 0;
      this.startTime = now;
    }

    if (this.isMonitoring) {
      requestAnimationFrame(() => this.measureFPS());
    }
  }
}

// Global performance monitor instance
export const performanceMonitor = new AnimationPerformanceMonitor();

// Utility to create safe animation styles
export function createAnimationStyle(
  property: string,
  duration: keyof typeof animationConfig.durations = 'normal',
  easing: keyof typeof animationConfig.easings = 'easeOut'
): React.CSSProperties {
  const safeDuration = getAnimationDuration(duration);

  if (safeDuration === 0) {
    return {}; // No animation for reduced motion
  }

  return {
    transition: `${property} ${safeDuration}ms ${animationConfig.easings[easing]}`
  };
}

// Utility to create safe transform animations
export function createTransformAnimation(
  transforms: string[],
  duration: keyof typeof animationConfig.durations = 'normal'
): React.CSSProperties {
  const safeDuration = getAnimationDuration(duration);

  return {
    transform: transforms.join(' '),
    transition: safeDuration > 0 ? `transform ${safeDuration}ms ${animationConfig.easings.easeOut}` : 'none'
  };
}

// Debug utilities for development
if (import.meta.env.DEV) {
  // Global debug helpers
  if (typeof window !== 'undefined') {
    (window as any).animationDebug = {
      // Force reduced motion for testing
      forceReducedMotion: (enabled: boolean) => {
        animationConfig.respectMotionPreference = !enabled;
        if (enabled) {
          document.documentElement.style.setProperty('--animation-duration', '0ms');
        } else {
          document.documentElement.style.removeProperty('--animation-duration');
        }
        console.log('🎭 Reduced motion:', enabled ? 'ENABLED' : 'DISABLED');
      },

      // Check current motion preference
      checkMotionPreference: () => {
        const prefers = getPrefersReducedMotion();
        const respects = animationConfig.respectMotionPreference;
        console.log('🎭 Motion preference:', {
          userPrefersReduced: prefers,
          respectingPreference: respects,
          effectivelyReduced: prefers && respects
        });
        return { prefers, respects };
      },

      // Start/stop performance monitoring
      startMonitoring: () => {
        performanceMonitor.startMonitoring();
        console.log('📊 Animation performance monitoring started');
      },

      stopMonitoring: () => {
        performanceMonitor.stopMonitoring();
        console.log('📊 Animation performance monitoring stopped');
      },

      // Test animation classes
      testAnimations: () => {
        console.log('🎭 Available animation classes:');
        console.table(animationClasses);
      },

      // Simulate slow device
      simulateSlowDevice: (enabled: boolean) => {
        if (enabled) {
          document.documentElement.style.setProperty('--animation-duration-multiplier', '3');
          console.log('🐌 Slow device simulation ENABLED');
        } else {
          document.documentElement.style.removeProperty('--animation-duration-multiplier');
          console.log('🐌 Slow device simulation DISABLED');
        }
      }
    };

    console.log('🎭 Animation debug helpers available on window.animationDebug');

    // Auto-start performance monitoring in dev mode
    if (import.meta.env.DEV) {
      performanceMonitor.startMonitoring();
    }
  }
}
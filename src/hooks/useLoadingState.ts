import { useState, useCallback, useRef, useEffect } from 'react';

export interface LoadingState {
  isLoading: boolean;
  progress?: number;
  message?: string;
  error?: string;
}

export interface UseLoadingStateOptions {
  minDisplayTime?: number; // Minimum time to show loading state (prevents flickering)
  debounceTime?: number;   // Debounce rapid state changes
}

export function useLoadingState(options: UseLoadingStateOptions = {}) {
  const { minDisplayTime = 200, debounceTime = 50 } = options;

  const [state, setState] = useState<LoadingState>({ isLoading: false });
  const loadingStartTime = useRef<number | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Clear debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const startLoading = useCallback((message?: string) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    loadingStartTime.current = Date.now();
    setState({ isLoading: true, progress: 0, message, error: undefined });
  }, []);

  const updateProgress = useCallback((progress: number, message?: string) => {
    setState(prev => ({
      ...prev,
      progress: Math.max(0, Math.min(100, progress)),
      message: message || prev.message
    }));
  }, []);

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, error, isLoading: false }));
  }, []);

  const stopLoading = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const finishLoading = () => {
      setState(prev => ({ ...prev, isLoading: false }));
      loadingStartTime.current = null;
    };

    // Ensure minimum display time to prevent flickering
    if (loadingStartTime.current) {
      const elapsed = Date.now() - loadingStartTime.current;
      if (elapsed < minDisplayTime) {
        debounceTimer.current = setTimeout(finishLoading, minDisplayTime - elapsed);
      } else {
        finishLoading();
      }
    } else {
      finishLoading();
    }
  }, [minDisplayTime]);

  const reset = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setState({ isLoading: false });
    loadingStartTime.current = null;
  }, []);

  return {
    ...state,
    startLoading,
    updateProgress,
    setError,
    stopLoading,
    reset
  };
}

// Hook for managing multiple loading states
export interface LoadingStateMap {
  [key: string]: LoadingState;
}

export function useMultipleLoadingStates() {
  const [states, setStates] = useState<LoadingStateMap>({});

  const startLoading = useCallback((key: string, message?: string) => {
    setStates(prev => ({
      ...prev,
      [key]: { isLoading: true, progress: 0, message, error: undefined }
    }));
  }, []);

  const updateProgress = useCallback((key: string, progress: number, message?: string) => {
    setStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        progress: Math.max(0, Math.min(100, progress)),
        message: message || prev[key]?.message
      }
    }));
  }, []);

  const setError = useCallback((key: string, error: string) => {
    setStates(prev => ({
      ...prev,
      [key]: { ...prev[key], error, isLoading: false }
    }));
  }, []);

  const stopLoading = useCallback((key: string) => {
    setStates(prev => ({
      ...prev,
      [key]: { ...prev[key], isLoading: false }
    }));
  }, []);

  const clearState = useCallback((key: string) => {
    setStates(prev => {
      const { [key]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const isAnyLoading = Object.values(states).some(state => state.isLoading);

  return {
    states,
    isAnyLoading,
    startLoading,
    updateProgress,
    setError,
    stopLoading,
    clearState
  };
}

// Hook for async operations with automatic loading state
export function useAsyncOperation<T = any>(options: UseLoadingStateOptions = {}) {
  const loadingState = useLoadingState(options);

  const execute = useCallback(async <R = T>(
    operation: () => Promise<R>,
    message?: string
  ): Promise<R | null> => {
    try {
      loadingState.startLoading(message);
      const result = await operation();
      loadingState.stopLoading();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      loadingState.setError(errorMessage);
      return null;
    }
  }, [loadingState]);

  return {
    ...loadingState,
    execute
  };
}

// Hook for progressive loading with multiple stages
export interface LoadingStage {
  name: string;
  message: string;
  weight: number; // Relative weight for progress calculation
}

export function useProgressiveLoading(stages: LoadingStage[]) {
  const loadingState = useLoadingState();
  const [currentStage, setCurrentStage] = useState<number>(-1);

  const totalWeight = stages.reduce((sum, stage) => sum + stage.weight, 0);

  const startStage = useCallback((stageIndex: number) => {
    if (stageIndex < 0 || stageIndex >= stages.length) return;

    const stage = stages[stageIndex];
    setCurrentStage(stageIndex);

    // Calculate progress based on completed stages
    const completedWeight = stages
      .slice(0, stageIndex)
      .reduce((sum, s) => sum + s.weight, 0);

    const progress = (completedWeight / totalWeight) * 100;

    if (stageIndex === 0) {
      loadingState.startLoading(stage.message);
    } else {
      loadingState.updateProgress(progress, stage.message);
    }
  }, [stages, totalWeight, loadingState]);

  const completeStage = useCallback((stageIndex: number) => {
    if (stageIndex < 0 || stageIndex >= stages.length) return;

    const completedWeight = stages
      .slice(0, stageIndex + 1)
      .reduce((sum, s) => sum + s.weight, 0);

    const progress = (completedWeight / totalWeight) * 100;
    loadingState.updateProgress(progress);

    if (stageIndex === stages.length - 1) {
      // All stages complete
      loadingState.stopLoading();
      setCurrentStage(-1);
    }
  }, [stages, totalWeight, loadingState]);

  const reset = useCallback(() => {
    setCurrentStage(-1);
    loadingState.reset();
  }, [loadingState]);

  return {
    ...loadingState,
    currentStage,
    currentStageName: currentStage >= 0 ? stages[currentStage]?.name : null,
    startStage,
    completeStage,
    reset
  };
}
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addUsedPair,
  clearUsedPairs,
  getAllCharacterIds,
  getUsedPairs,
  loadPairDetails,
  makePairHash,
  pickRandomDistinctPair,
  type CharacterRow,
  type DuelPair,
  SCOPE_KEY,
} from '@/lib/duels';
import CharacterCard from '@/components/CharacterCard';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabaseClient';
import { showToast } from '@/lib/toast';
import { fetchUniverses, type Universe } from '@/lib/top';
import { getRecentSeenPairs, markPairSeen } from '@/lib/seenPairs';
import { getStorageAdapter, type StorageAdapter } from '@/lib/storageAdapter';
import { db } from '@/lib/kibakiDB';
import { FadeTransition, TransitionWrapper } from '@/components/TransitionWrapper';
import { SkeletonDuel } from '@/components/SkeletonCard';
import { useLoadingState } from '@/hooks/useLoadingState';
import { animationClasses, getPrefersReducedMotion } from '@/lib/animations';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

// Optimistic vote state types
type OptimisticVoteState = {
  winnerId: number | null;
  status: 'idle' | 'pending' | 'success' | 'error';
};

// Debug mode for testing scenarios
const DEBUG_MODE = import.meta.env.DEV;
const DEBUG_PREFETCH = import.meta.env.DEV;

// Prefetch system types and config
interface PrefetchedDuel {
  left: CharacterRow;
  right: CharacterRow;
  hash: string;
  timestamp: number;
  scope: string;
  imagesLoaded: boolean;
}

const PREFETCH_CONFIG = {
  maxQueueSize: 3,
  prefetchDelay: 500, // Start prefetching 500ms after duel display
  imageTimeout: 5000, // Max time to wait for image preload
  maxAge: 60000, // 1 minute max age for prefetched duels
};

export default function DuelContainer() {
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [ids, setIds] = useState<number[]>([]);
  const [pair, setPair] = useState<DuelPair | null>(null);
  const [openLeft, setOpenLeft] = useState(false);
  const [openRight, setOpenRight] = useState(false);
  const [lastVote, setLastVote] = useState<'left' | 'right' | null>(null);
  const [rateLimitedAt, setRateLimitedAt] = useState<number | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [lastVoteAt, setLastVoteAt] = useState<number | null>(null);

  // Optimistic UI states
  const [optimisticVote, setOptimisticVote] = useState<OptimisticVoteState>({
    winnerId: null,
    status: 'idle'
  });
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Prefetch system states
  const [prefetchQueue, setPrefetchQueue] = useState<PrefetchedDuel[]>([]);
  const prefetchingRef = useRef<boolean>(false);

  // Storage adapter
  const [storage, setStorage] = useState<StorageAdapter | null>(null);

  // Animation and loading states
  const loadingState = useLoadingState({ minDisplayTime: 300 });
  const reducedMotion = getPrefersReducedMotion();
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [scope, setScope] = useState<string>('global');
  const scopeRef = useRef<string>('global');
  const mountedRef = useRef<boolean>(false);
  const bootstrappedRef = useRef<boolean>(false);

  const usedPairs = useMemo(() => getUsedPairs(scope), [scope]);

  // Initialize storage adapter
  useEffect(() => {
    const initStorage = async () => {
      try {
        const adapter = await getStorageAdapter();
        setStorage(adapter);

        // Run initial cleanup
        await adapter.cleanup();
      } catch (error) {
        console.error('Failed to initialize storage:', error);
      }
    };

    initStorage();
  }, []);

  // Image preloading utility
  const preloadImages = async (characters: CharacterRow[]): Promise<boolean> => {
    const promises = characters
      .filter(char => char.image_url)
      .map(char => {
        return new Promise<boolean>((resolve) => {
          const img = new Image();
          const timeout = setTimeout(() => {
            if (DEBUG_PREFETCH) console.log('Image preload timeout:', char.name);
            resolve(false);
          }, PREFETCH_CONFIG.imageTimeout);

          img.onload = () => {
            clearTimeout(timeout);
            if (DEBUG_PREFETCH) console.log('Image preloaded:', char.name);
            resolve(true);
          };
          img.onerror = () => {
            clearTimeout(timeout);
            if (DEBUG_PREFETCH) console.warn('Image preload failed:', char.name);
            resolve(false); // Don't fail entire prefetch on image error
          };

          img.src = char.image_url!;
        });
      });

    try {
      const results = await Promise.all(promises);
      const allLoaded = results.every(Boolean);
      if (DEBUG_PREFETCH) {
        console.log('Images preload result:', { allLoaded, loaded: results.filter(Boolean).length, total: results.length });
      }
      return allLoaded;
    } catch {
      return false; // Partial load is still acceptable
    }
  };

  // Enhanced image preloading with IndexedDB caching
  const preloadImagesWithCache = async (characters: CharacterRow[]): Promise<boolean> => {
    if (!storage) return preloadImages(characters);

    const promises = characters
      .filter(char => char.image_url)
      .map(async char => {
        try {
          // Check if image is already cached
          const cachedBlob = await storage.getImageBlob(char.id);
          if (cachedBlob) {
            if (DEBUG_PREFETCH) console.log('Image found in cache:', char.name);
            return true;
          }

          // Download and cache image
          return new Promise<boolean>((resolve) => {
            const img = new Image();
            const timeout = setTimeout(() => {
              if (DEBUG_PREFETCH) console.log('Image preload timeout:', char.name);
              resolve(false);
            }, PREFETCH_CONFIG.imageTimeout);

            img.onload = async () => {
              clearTimeout(timeout);
              try {
                // Convert to blob and cache
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  canvas.width = img.naturalWidth;
                  canvas.height = img.naturalHeight;
                  ctx.drawImage(img, 0, 0);

                  canvas.toBlob(async (blob) => {
                    if (blob && storage) {
                      await storage.cacheImage(char.id, char.image_url!, blob);
                      if (DEBUG_PREFETCH) {
                        console.log('Image cached:', char.name, `${blob.size} bytes`);
                      }
                    }
                  }, 'image/jpeg', 0.8);
                }
              } catch (error) {
                if (DEBUG_PREFETCH) console.warn('Image caching failed:', char.name, error);
              }
              resolve(true);
            };

            img.onerror = () => {
              clearTimeout(timeout);
              if (DEBUG_PREFETCH) console.warn('Image preload failed:', char.name);
              resolve(false);
            };

            img.src = char.image_url!;
          });
        } catch (error) {
          if (DEBUG_PREFETCH) console.warn('Image cache check failed:', char.name, error);
          return false;
        }
      });

    try {
      const results = await Promise.all(promises);
      const allLoaded = results.every(Boolean);
      if (DEBUG_PREFETCH) {
        console.log('Enhanced images preload result:', {
          allLoaded,
          loaded: results.filter(Boolean).length,
          total: results.length
        });
      }
      return allLoaded;
    } catch {
      return false;
    }
  };

  // Memory monitoring (development only)
  const monitorMemory = () => {
    if (DEBUG_PREFETCH && 'memory' in performance) {
      const memory = (performance as any).memory;
      console.log('Memory usage:', {
        used: Math.round(memory.usedJSHeapSize / 1048576) + 'MB',
        total: Math.round(memory.totalJSHeapSize / 1048576) + 'MB',
        queueSize: prefetchQueue.length
      });
    }
  };

  // Enhanced prefetch logic with storage adapter
  const prefetchNextDuels = async () => {
    if (prefetchingRef.current) return; // Prevent concurrent prefetching
    if (prefetchQueue.length >= PREFETCH_CONFIG.maxQueueSize) return;
    if (!ids.length || ids.length < 2 || !storage) return;

    prefetchingRef.current = true;

    try {
      // Calculate how many to prefetch
      const toPrefetch = PREFETCH_CONFIG.maxQueueSize - prefetchQueue.length;
      const currentUsedPairs = getUsedPairs(scope);
      const cachedPairs = await storage.getPairHashes(scope);

      if (DEBUG_PREFETCH) {
        console.log('Starting prefetch:', {
          toPrefetch,
          queueSize: prefetchQueue.length,
          scope,
          cachedPairs: cachedPairs.length
        });
      }

      for (let i = 0; i < toPrefetch; i++) {
        try {
          // Try to get pair from cache first
          let left: CharacterRow | null = null;
          let right: CharacterRow | null = null;
          let hash: string = '';

          // Attempt to build pair from cached characters
          const cachedIds = await storage.getCharacterIds(scope);
          if (cachedIds.length >= 2) {
            for (let attempt = 0; attempt < 10; attempt++) {
              const leftId = cachedIds[Math.floor(Math.random() * cachedIds.length)];
              const rightId = cachedIds[Math.floor(Math.random() * cachedIds.length)];

              if (leftId !== rightId) {
                hash = makePairHash(leftId, rightId);
                if (!currentUsedPairs.has(hash) && !cachedPairs.includes(hash)) {
                  const cachedLeft = await storage.getCharacter(leftId);
                  const cachedRight = await storage.getCharacter(rightId);

                  if (cachedLeft && cachedRight) {
                    left = cachedLeft;
                    right = cachedRight;
                    break;
                  }
                }
              }
            }
          }

          // Fallback to API if cache miss
          if (!left || !right) {
            const [leftId, rightId, newHash] = pickRandomDistinctPair(ids, currentUsedPairs);
            const { left: apiLeft, right: apiRight } = await loadPairDetails(leftId, rightId);
            left = apiLeft;
            right = apiRight;
            hash = newHash;

            // Cache the newly fetched characters
            if (storage) {
              await storage.setCharacter(left);
              await storage.setCharacter(right);
            }
          }

          // Enhanced image preloading with caching
          const imagesLoaded = await preloadImagesWithCache([left, right]);

          // Add to queue
          const prefetchedDuel: PrefetchedDuel = {
            left,
            right,
            hash,
            timestamp: Date.now(),
            scope,
            imagesLoaded
          };

          setPrefetchQueue(prev => {
            // Check if this pair is already in queue
            if (prev.some(d => d.hash === hash)) {
              if (DEBUG_PREFETCH) console.log('Duplicate pair in prefetch, skipping:', hash);
              return prev;
            }
            const newQueue = [...prev, prefetchedDuel];
            if (DEBUG_PREFETCH) {
              console.log('Added to prefetch queue:', { hash, imagesLoaded, queueSize: newQueue.length });
            }
            return newQueue;
          });

          // Add to used pairs cache
          addUsedPair(hash, scope);
          if (storage) {
            await storage.addPairHash(scope, hash);
          }
        } catch (error) {
          if (DEBUG_PREFETCH) console.warn('Individual prefetch failed:', error);
          // Continue prefetching others
        }
      }
    } catch (error) {
      if (DEBUG_PREFETCH) console.warn('Prefetch batch failed:', error);
    } finally {
      prefetchingRef.current = false;
      if (DEBUG_PREFETCH) monitorMemory();
    }
  };

  // bootstrap
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    mountedRef.current = true;

    (async () => {
      setState('loading');
      setError(null);
      loadingState.startLoading('Loading characters...');

      try {
        // Load universes
        loadingState.updateProgress(20, 'Loading universes...');
        const u = await fetchUniverses();
        if (!mountedRef.current) return;
        setUniverses(u);

        // Load saved scope from LS
        loadingState.updateProgress(40, 'Initializing scope...');
        let savedScope = 'global';
        try {
          if (typeof window !== 'undefined' && 'localStorage' in window) {
            const s = window.localStorage.getItem(SCOPE_KEY);
            if (s && typeof s === 'string') savedScope = s;
          }
        } catch {}
        if (!mountedRef.current) return;
        setScope(savedScope);

        // Fetch ids for scope
        loadingState.updateProgress(60, 'Fetching character data...');
        const fetchedIds = await getAllCharacterIds(savedScope);
        if (!mountedRef.current) return;
        setIds(fetchedIds);

        // (A) Immediately load a local pair without waiting for any auth/server merge
        loadingState.updateProgress(80, 'Preparing duel...');
        if (fetchedIds.length >= 2) {
          await loadFreshPair(fetchedIds, getUsedPairs(savedScope));
        } else {
          setPair(null);
        }
        if (!mountedRef.current) return;

        loadingState.updateProgress(100, 'Ready!');
        setState('ready');
        loadingState.stopLoading();

        // (C) Start initial prefetching after first duel is loaded
        setTimeout(() => prefetchNextDuels(), PREFETCH_CONFIG.prefetchDelay);
      } catch (e: any) {
        if (!mountedRef.current) return;
        const errorMessage = e?.message ?? String(e);
        setError(errorMessage);
        setState('error');
        loadingState.setError(errorMessage);
      }
    })();

    // (B) In parallel, non-blocking: merge server seen pairs if user is logged-in
    (async () => {
      try {
        const server = await getRecentSeenPairs(500);
        if (!mountedRef.current) return;
        const currentScope = scopeRef.current || 'global';
        server.forEach((k) => addUsedPair(k, currentScope));
      } catch {}
    })();

    return () => { mountedRef.current = false; };
  }, []);

  // When scope changes (via UI), reload ids and reset pair memory for that scope
  useEffect(() => {
    scopeRef.current = scope;

    // Clear prefetch queue for scope changes (keep only matching scope)
    setPrefetchQueue(prev => {
      const filtered = prev.filter(d => d.scope === scope);
      if (DEBUG_PREFETCH && filtered.length !== prev.length) {
        console.log('Cleared prefetch queue for scope change:', {
          from: prev.length,
          to: filtered.length,
          scope
        });
      }
      return filtered;
    });

    const run = async () => {
      // Skip first pass if state is still idle/loading from init; init handles first fetch
      if (state === 'idle') return;
      setState('loading');
      setError(null);
      try {
        // Persist scope
        try {
          if (typeof window !== 'undefined' && 'localStorage' in window) {
            window.localStorage.setItem(SCOPE_KEY, scope);
          }
        } catch {}

        // Reset pair memory only for the selected scope
        clearUsedPairs(scope);
        setPair(null);

        const fetchedIds = await getAllCharacterIds(scope, true);
        if (!mountedRef.current) return;
        setIds(fetchedIds);

        // Immediately load a local pair for the new scope
        if (fetchedIds.length >= 2) {
          await loadFreshPair(fetchedIds, getUsedPairs(scope));
        } else {
          setPair(null);
        }

        setState('ready');

        // Start prefetching for new scope after initial load
        setTimeout(() => prefetchNextDuels(), PREFETCH_CONFIG.prefetchDelay);
      } catch (e: any) {
        if (!mountedRef.current) return;
        setError(e?.message ?? String(e));
        setState('error');
      }
    };
    run();

    // Non-blocking merge of server-seen pairs for this scope
    (async () => {
      try {
        const server = await getRecentSeenPairs(500);
        if (!mountedRef.current) return;
        server.forEach((k) => addUsedPair(k, scope));
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  // When user logs in during the session, merge server-seen pairs into current scope
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        try {
          const server = await getRecentSeenPairs(500);
          const currentScope = scopeRef.current;
          server.forEach((k) => addUsedPair(k, currentScope));
        } catch {}
      }
    });
    return () => {
      listener.subscription.unsubscribe();
    };
    // We intentionally don't include scope to avoid re-subscribing; scope value is captured
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Migration from localStorage to IndexedDB
  useEffect(() => {
    const migrateFromLocalStorage = async () => {
      if (!storage) return;

      try {
        // Check if migration needed
        const migrated = localStorage.getItem('kibaki_migrated_to_idb');
        if (migrated === 'true') return;

        if (DEBUG_PREFETCH) {
          console.log('🔄 Starting migration from localStorage to IndexedDB...');
        }

        // Migrate character IDs and universe data if available
        const keys = Object.keys(localStorage).filter(k =>
          k.startsWith('kibaki_char_ids_v1::') || k.startsWith('kibaki_pair_hashes_v1::')
        );

        let migrationCount = 0;

        for (const key of keys) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              if (key.includes('char_ids')) {
                const { ids } = JSON.parse(data);
                const scopeName = key.split('::')[1];
                if (DEBUG_PREFETCH) {
                  console.log(`Migrating ${ids.length} character IDs from scope ${scopeName}`);
                }
                // Note: We can't migrate full character data from localStorage
                // This will be populated on-demand
              } else if (key.includes('pair_hashes')) {
                const pairs = JSON.parse(data);
                const scopeName = key.split('::')[1];
                if (Array.isArray(pairs)) {
                  for (const hash of pairs) {
                    await storage.addPairHash(scopeName, hash);
                  }
                  migrationCount += pairs.length;
                  if (DEBUG_PREFETCH) {
                    console.log(`Migrated ${pairs.length} pair hashes from scope ${scopeName}`);
                  }
                }
              }
            }
          } catch (error) {
            console.warn('Failed to migrate key:', key, error);
          }
        }

        // Mark as migrated
        localStorage.setItem('kibaki_migrated_to_idb', 'true');

        if (DEBUG_PREFETCH && migrationCount > 0) {
          console.log(`✅ Migration complete: ${migrationCount} items migrated`);
        }
      } catch (error) {
        console.error('Migration failed:', error);
      }
    };

    if (storage) {
      migrateFromLocalStorage();
    }
  }, [storage]);

  // Auto-cleanup old prefetches and storage management
  useEffect(() => {
    const cleanup = setInterval(async () => {
      const now = Date.now();

      // Clean prefetch queue
      setPrefetchQueue(prev => {
        const filtered = prev.filter(d =>
          (now - d.timestamp) < PREFETCH_CONFIG.maxAge && d.scope === scope
        );
        if (DEBUG_PREFETCH && filtered.length !== prev.length) {
          console.log('Cleaned up old prefetches:', {
            from: prev.length,
            to: filtered.length,
            removed: prev.length - filtered.length
          });
          monitorMemory();
        }
        return filtered;
      });

      // Clean storage
      if (storage) {
        try {
          await storage.cleanup();

          // Monitor storage quota
          if (storage instanceof Promise || 'getStorageInfo' in storage) {
            const storageInfo = await db.getStorageInfo();
            if (storageInfo && storageInfo.percent > 80) {
              console.warn('Storage quota high:', storageInfo.percent + '%');
              // Could trigger more aggressive cleanup if needed
            }
          }
        } catch (error) {
          console.warn('Storage cleanup failed:', error);
        }
      }
    }, 300000); // Every 5 minutes

    return () => clearInterval(cleanup);
  }, [scope, storage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear prefetch queue to free memory
      setPrefetchQueue([]);
      prefetchingRef.current = false;
      if (DEBUG_PREFETCH) {
        console.log('Component unmounting, cleared prefetch queue');
      }
    };
  }, []);

  // Debug helpers for development
  useEffect(() => {
    if (DEBUG_PREFETCH && typeof window !== 'undefined') {
      (window as any).kibakiDebug = {
        clearPrefetch: () => {
          setPrefetchQueue([]);
          console.log('Prefetch queue cleared manually');
        },
        queueStatus: () => {
          console.table(prefetchQueue.map(d => ({
            hash: d.hash,
            scope: d.scope,
            imagesLoaded: d.imagesLoaded,
            age: Math.round((Date.now() - d.timestamp) / 1000) + 's'
          })));
          return prefetchQueue;
        },
        forcePrefetch: () => {
          prefetchNextDuels();
          console.log('Forced prefetch triggered');
        },
        memoryStatus: () => {
          monitorMemory();
        },
        simulateSlowNetwork: () => {
          console.log('Use ?debug=slow-network in URL to simulate slow network');
        },
        // New storage-related debug helpers
        storageInfo: async () => {
          if (storage) {
            const stats = await db.getCacheStats();
            const info = await db.getStorageInfo();
            console.log('💾 Storage Statistics:', stats);
            console.log('📊 Quota Information:', info);
            return { stats, info };
          }
          console.log('No storage adapter available');
        },
        cacheCharacter: async (id: number) => {
          if (storage) {
            const char = await storage.getCharacter(id);
            console.log('Character cache lookup:', char);
            return char;
          }
        },
        migrationStatus: () => {
          const migrated = localStorage.getItem('kibaki_migrated_to_idb');
          console.log('Migration status:', migrated === 'true' ? 'Completed' : 'Pending');
          return migrated;
        },
        testStorageAdapter: async () => {
          if (storage) {
            const available = await storage.isAvailable();
            console.log('Storage adapter available:', available);

            // Test character caching
            const testChar = {
              id: 999999,
              name: 'Test Character',
              slug: 'test-char',
              description: 'Test character for debugging',
              image_url: null,
              elo: 1000,
              wins: 0,
              losses: 0
            };

            await storage.setCharacter(testChar);
            const retrieved = await storage.getCharacter(999999);
            console.log('Character cache test:', retrieved);

            return { available, cacheTest: !!retrieved };
          }
        },
        // Animation performance monitoring
        startAnimationMonitoring: () => {
          (window as any).animationDebug?.startMonitoring();
        },
        stopAnimationMonitoring: () => {
          (window as any).animationDebug?.stopMonitoring();
        },
        testReducedMotion: () => {
          const prefers = getPrefersReducedMotion();
          console.log('User prefers reduced motion:', prefers);
          return prefers;
        },
        simulateSlowAnimations: (enabled: boolean) => {
          if (enabled) {
            document.documentElement.style.setProperty('--animation-multiplier', '3');
            console.log('🐌 Slow animations enabled');
          } else {
            document.documentElement.style.removeProperty('--animation-multiplier');
            console.log('⚡ Normal animation speed restored');
          }
        }
      };

      console.log('🔧 Kibaki Debug helpers available on window.kibakiDebug');
    }
  }, [prefetchQueue]);

  const loadFreshPair = async (allIds: number[], avoid: Set<string>) => {
    if (!Array.isArray(allIds) || allIds.length < 2) {
      setPair(null);
      return;
    }

    // Try to use prefetched duel first
    const validPrefetch = prefetchQueue.find(d =>
      d.scope === scope &&
      !avoid.has(d.hash) &&
      (Date.now() - d.timestamp) < PREFETCH_CONFIG.maxAge
    );

    if (validPrefetch) {
      // Use prefetched duel immediately
      setPair({ left: validPrefetch.left, right: validPrefetch.right, hash: validPrefetch.hash });

      // Remove used duel from queue
      setPrefetchQueue(prev => prev.filter(d => d !== validPrefetch));

      if (DEBUG_PREFETCH) {
        console.log('Used prefetched duel:', {
          hash: validPrefetch.hash,
          imagesLoaded: validPrefetch.imagesLoaded,
          age: Date.now() - validPrefetch.timestamp
        });
      }

      // Start prefetching more in background
      setTimeout(() => prefetchNextDuels(), PREFETCH_CONFIG.prefetchDelay);
      return;
    }

    // Fallback to normal loading
    if (DEBUG_PREFETCH) {
      console.log('No valid prefetch available, using normal loading');
    }

    const [leftId, rightId, hash] = pickRandomDistinctPair(allIds, avoid);
    const { left, right } = await loadPairDetails(leftId, rightId);
    setPair({ left, right, hash });

    // Start prefetching for future after loading current pair
    setTimeout(() => prefetchNextDuels(), PREFETCH_CONFIG.prefetchDelay);
  };

  const postVote = async (winnerId: number, loserId: number) => {
    const nonce = crypto.randomUUID();

    // Debug mode: simulate different scenarios
    if (DEBUG_MODE) {
      console.log('🔧 DEBUG: Vote initiated', { winnerId, loserId, nonce });

      // Check URL params for debug scenarios
      const urlParams = new URLSearchParams(window.location.search);
      const debugScenario = urlParams.get('debug');

      switch (debugScenario) {
        case 'rate-limit':
          console.log('🔧 DEBUG: Simulating rate limit');
          await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
          return { ok: false, reason: 'rate_limited', duplicate: false, result: {} };

        case 'server-error':
          console.log('🔧 DEBUG: Simulating server error');
          await new Promise(resolve => setTimeout(resolve, 500));
          return { ok: false, reason: 'server_error', duplicate: false, result: {} };

        case 'network-error':
          console.log('🔧 DEBUG: Simulating network error');
          await new Promise(resolve => setTimeout(resolve, 200));
          throw new Error('Network connection failed');

        case 'slow-network':
          console.log('🔧 DEBUG: Simulating slow network');
          await new Promise(resolve => setTimeout(resolve, 2000));
          break; // Continue to normal flow

        default:
          console.log('🔧 DEBUG: Normal flow - Add ?debug=rate-limit|server-error|network-error|slow-network to test scenarios');
      }
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    const url = `${import.meta.env.PUBLIC_SUPABASE_URL}/functions/v1/vote`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ winner_id: winnerId, loser_id: loserId, nonce }),
    });

    const result: any = await response.json().catch(() => ({}));

    if (DEBUG_MODE) {
      console.log('🔧 DEBUG: Vote response', { ok: response.ok, result });
    }

    return {
      ok: response.ok,
      reason: result?.reason,
      duplicate: result?.duplicate,
      result
    };
  };

  const vote = async (side: 'left' | 'right') => {
    if (!pair) return;
    if (isVoting || isTransitioning) return; // ignore if already voting or transitioning
    const now = Date.now();
    if (now - (lastVoteAt ?? 0) < 700) return; // throttle rapid clicks

    const currentPair = pair;
    const winnerId = side === 'left' ? currentPair.left.id : currentPair.right.id;
    const loserId = side === 'left' ? currentPair.right.id : currentPair.left.id;

    // Optimistic UI: Immediate visual feedback
    setOptimisticVote({ winnerId, status: 'pending' });
    setIsTransitioning(true);
    setIsVoting(true);

    try {
      // API call in background
      const voteResult = await postVote(winnerId, loserId);

      if (!voteResult.ok && voteResult.reason === 'rate_limited') {
        // Rollback with shake animation
        setOptimisticVote({ winnerId, status: 'error' });
        setRateLimitedAt(Date.now());
        showToast({ type: 'error', message: 'Trop de votes, réessayez dans un instant.' });
        // Reset UI state after shake animation
        setTimeout(() => {
          setOptimisticVote({ winnerId: null, status: 'idle' });
          setIsTransitioning(false);
          setIsVoting(false);
        }, 600);
        return;
      } else if (!voteResult.ok) {
        // Network/server error - rollback
        setOptimisticVote({ winnerId, status: 'error' });
        showToast({ type: 'error', message: 'Une erreur est survenue lors du vote.' });
        setTimeout(() => {
          setOptimisticVote({ winnerId: null, status: 'idle' });
          setIsTransitioning(false);
          setIsVoting(false);
        }, 600);
        return;
      } else {
        // Success path
        setOptimisticVote({ winnerId, status: 'success' });
        showToast({ type: 'info', message: 'Vote pris en compte' });

        // Update state and load next duel during success animation
        setLastVoteAt(Date.now());
        addUsedPair(currentPair.hash, scope);
        try { void markPairSeen(currentPair.hash).catch(() => {}); } catch {}
        setLastVote(side);

        // Load next duel after brief success animation
        setTimeout(async () => {
          await loadFreshPair(ids, getUsedPairs(scope));
          setOptimisticVote({ winnerId: null, status: 'idle' });
          setIsTransitioning(false);
          setIsVoting(false);
        }, 400);
      }
    } catch (e: any) {
      // Network error - rollback
      setOptimisticVote({ winnerId, status: 'error' });
      showToast({ type: 'error', message: 'Impossible d\'envoyer votre vote.' });
      setTimeout(() => {
        setOptimisticVote({ winnerId: null, status: 'idle' });
        setIsTransitioning(false);
        setIsVoting(false);
      }, 600);
    }
  };

  const skip = async () => {
    if (!pair) return;
    addUsedPair(pair.hash, scope);
    // Fire-and-forget server write for logged-in users
    try { void markPairSeen(pair.hash).catch(() => {}); } catch {}
    try {
      await loadFreshPair(ids, getUsedPairs(scope));
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setState('error');
    }
  };

  const resetPairs = async () => {
    clearUsedPairs(scope);
    try {
      await loadFreshPair(ids, getUsedPairs(scope));
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setState('error');
    }
  };

  if (state === 'loading' || state === 'idle') {
    return (
      <FadeTransition show={true} className="mx-auto max-w-5xl">
        <SkeletonDuel />
        {loadingState.isLoading && loadingState.message && (
          <div className="mt-4 text-center">
            <div className="text-sm text-gray-600 mb-2">{loadingState.message}</div>
            {loadingState.progress !== undefined && (
              <div className="w-full bg-gray-200 rounded-full h-1">
                <div
                  className={`h-1 bg-blue-500 rounded-full transition-all duration-300 ${
                    reducedMotion ? '' : 'ease-out'
                  }`}
                  style={{ width: `${loadingState.progress}%` }}
                />
              </div>
            )}
          </div>
        )}
      </FadeTransition>
    );
  }

  if (state === 'error') {
    return (
      <FadeTransition show={true}>
        <div className={`rounded-2xl border bg-white p-6 text-sm text-red-600 ${animationClasses.error}`}>
          <div className="flex items-center space-x-2">
            <span className="text-red-500">⚠️</span>
            <span>{error ?? 'An error occurred.'}</span>
          </div>
          {loadingState.error && (
            <div className="mt-2 text-xs text-red-500">
              {loadingState.error}
            </div>
          )}
        </div>
      </FadeTransition>
    );
  }

  if (ids.length < 2) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ScopeSelector universes={universes} value={scope} onChange={setScope} />
        </div>
        <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
          Pas assez de personnages dans cet univers pour lancer un duel.
        </div>
      </div>
    );
  }

  if (!pair) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ScopeSelector universes={universes} value={scope} onChange={(s) => setScope(s)} />
        </div>
        <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
          Chargement d'une paire...
        </div>
      </div>
    );
  }

  const { left, right, hash } = pair;

  // Animation classes for character cards (respects reduced motion)
  const getCardAnimationClasses = (characterId: number) => {
    const baseTransition = reducedMotion ? '' : 'transform transition-all duration-300';

    if (optimisticVote.winnerId === characterId) {
      switch (optimisticVote.status) {
        case 'pending':
          return `${baseTransition} ${reducedMotion ? 'ring-4 ring-green-500 ring-opacity-50' : 'scale-105 ring-4 ring-green-500 ring-opacity-50 animate-pulse'}`;
        case 'success':
          return `${baseTransition} ${reducedMotion ? 'ring-4 ring-green-500 ring-opacity-75' : 'scale-105 ring-4 ring-green-500 ring-opacity-75'}`;
        case 'error':
          return `${baseTransition} ${reducedMotion ? 'ring-4 ring-red-500 ring-opacity-50' : 'animate-shake ring-4 ring-red-500 ring-opacity-50'}`;
        default:
          return '';
      }
    } else if (optimisticVote.winnerId && optimisticVote.winnerId !== characterId && optimisticVote.status === 'pending') {
      return reducedMotion ? 'opacity-50' : 'opacity-50 scale-95 transition-all duration-300';
    }
    return '';
  };

  // Button classes for animation states
  const getButtonClasses = (characterId: number, baseClasses: string) => {
    const disabled = isVoting || isTransitioning;
    const isWinner = optimisticVote.winnerId === characterId;

    let classes = baseClasses;

    if (disabled) {
      classes += ' cursor-not-allowed opacity-50';
    } else {
      classes += ' hover:scale-105';
    }

    if (isWinner && optimisticVote.status === 'success') {
      classes += ' bg-green-600';
    } else if (isWinner && optimisticVote.status === 'error') {
      classes += ' bg-red-600';
    }

    classes += ' transition-all duration-200';

    return classes;
  };

  return (
    <TransitionWrapper show={state === 'ready'} duration="fast">
      <div className="space-y-4">
        <FadeTransition show={true} duration="fast">
          <div className="flex items-center gap-3">
            <ScopeSelector universes={universes} value={scope} onChange={(s) => setScope(s)} />
          </div>
        </FadeTransition>

        <TransitionWrapper
          show={!isTransitioning}
          duration="normal"
          className={reducedMotion ? '' : 'transform transition-all duration-300'}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col">
              <CharacterCard
                character={left}
                side="left"
                onMore={() => setOpenLeft(true)}
                className={getCardAnimationClasses(left.id)}
              />
              <button
                onClick={() => vote('left')}
                disabled={isVoting || isTransitioning}
                className={getButtonClasses(left.id, "mt-3 rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed")}
              >
                Voter à gauche
              </button>
            </div>

            <div className="flex flex-col">
              <CharacterCard
                character={right}
                side="right"
                onMore={() => setOpenRight(true)}
                className={getCardAnimationClasses(right.id)}
              />
              <button
                onClick={() => vote('right')}
                disabled={isVoting || isTransitioning}
                className={getButtonClasses(right.id, "mt-3 rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed")}
              >
                Voter à droite
              </button>
            </div>
          </div>
        </TransitionWrapper>

        <FadeTransition show={true} duration="fast">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={skip}
              className={`rounded border px-3 py-1.5 ${animationClasses.interactive} ${
                reducedMotion ? '' : 'hover:scale-105'
              }`}
            >
              Passer
            </button>
            <button
              onClick={resetPairs}
              className={`rounded border px-3 py-1.5 ${animationClasses.interactive} ${
                reducedMotion ? '' : 'hover:scale-105'
              }`}
            >
              Réinitialiser les paires
            </button>
            {import.meta.env.DEV ? (
              <span className="text-xs text-gray-500">hash: {hash}</span>
            ) : null}
            {lastVote ? (
              <span className="ml-auto text-xs text-gray-500">Sauvegardé localement.</span>
            ) : null}
          </div>
        </FadeTransition>
      </div>

      {/* Modals */}
      <Modal open={openLeft} onClose={() => setOpenLeft(false)} title={left.name}>
        <CharacterDetails character={left} />
      </Modal>
      <Modal open={openRight} onClose={() => setOpenRight(false)} title={right.name}>
        <CharacterDetails character={right} />
      </Modal>
    </TransitionWrapper>
  );
}

function CharacterDetails({ character }: { character: CharacterRow }) {
  return (
    <div className="space-y-2 text-sm text-gray-700">
      <div className="text-gray-900">ELO: <strong>{character.elo}</strong></div>
      <div>Wins: <strong>{character.wins}</strong></div>
      <div>Losses: <strong>{character.losses}</strong></div>
      {character.description ? (
        <p className="pt-2 text-gray-700">{character.description}</p>
      ) : (
        <p className="pt-2 text-gray-400">No description.</p>
      )}
    </div>
  );
}

function ScopeSelector({ universes, value, onChange }: { universes: Universe[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">Univers:</label>
      <select
        className="rounded border px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="global">Global</option>
        {universes.map((u) => (
          <option key={u.id} value={u.slug}>{u.name}</option>
        ))}
      </select>
    </div>
  );
}



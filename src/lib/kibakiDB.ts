import Dexie, { type Table } from 'dexie';
import type { CharacterRow } from './duels';

// Extended character interface for caching
export interface CachedCharacter extends CharacterRow {
  universe_id?: number;
  image_blob?: Blob; // Cached image data
  cached_at: number;
  ttl: number; // Time to live in ms
}

export interface CachedPair {
  hash: string; // "12:34" format
  scope: string; // "global" or universe slug
  seen_at: number;
  ttl: number;
}

export interface UserSeenPair {
  user_id: string;
  pair_hash: string;
  seen_at: number;
}

export interface CachedUniverse {
  id: number;
  slug: string;
  name: string;
  cached_at: number;
  ttl: number;
}

class KibakiDB extends Dexie {
  characters!: Table<CachedCharacter>;
  pairs!: Table<CachedPair>;
  userSeenPairs!: Table<UserSeenPair>;
  universes!: Table<CachedUniverse>;

  constructor() {
    super('KibakiDB');

    this.version(1).stores({
      characters: 'id, universe_id, [universe_id+elo], cached_at, slug',
      pairs: '[hash+scope], hash, scope, seen_at',
      userSeenPairs: '[user_id+pair_hash], user_id, seen_at',
      universes: 'id, slug, cached_at'
    });

    // Add hooks for debugging in development
    if (import.meta.env.DEV) {
      this.characters.hook('creating', (primKey, obj, trans) => {
        console.log('💾 Caching character:', obj.name);
      });

      this.characters.hook('updating', (modifications, primKey, obj, trans) => {
        if ((modifications as any).image_blob) {
          console.log('🖼️ Cached image for:', (obj as any).name);
        }
      });
    }
  }

  // Clean expired entries
  async cleanExpired() {
    const now = Date.now();

    try {
      // Clean expired characters
      const expiredChars = await this.characters
        .where('cached_at')
        .below(now - 3600000) // 1 hour old
        .count();

      if (expiredChars > 0) {
        await this.characters
          .where('cached_at')
          .below(now - 3600000)
          .delete();
        console.log(`🧹 Cleaned ${expiredChars} expired characters`);
      }

      // Clean expired pairs (keep for 24 hours)
      const expiredPairs = await this.pairs
        .where('seen_at')
        .below(now - 86400000) // 24 hours
        .count();

      if (expiredPairs > 0) {
        await this.pairs
          .where('seen_at')
          .below(now - 86400000)
          .delete();
        console.log(`🧹 Cleaned ${expiredPairs} expired pairs`);
      }

      // Clean old user seen pairs (keep for 7 days)
      const expiredUserPairs = await this.userSeenPairs
        .where('seen_at')
        .below(now - 604800000) // 7 days
        .count();

      if (expiredUserPairs > 0) {
        await this.userSeenPairs
          .where('seen_at')
          .below(now - 604800000)
          .delete();
        console.log(`🧹 Cleaned ${expiredUserPairs} expired user pairs`);
      }

      // Clean expired universes
      const expiredUniverses = await this.universes
        .where('cached_at')
        .below(now - 3600000) // 1 hour
        .count();

      if (expiredUniverses > 0) {
        await this.universes
          .where('cached_at')
          .below(now - 3600000)
          .delete();
        console.log(`🧹 Cleaned ${expiredUniverses} expired universes`);
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  // Get storage size estimate
  async getStorageInfo() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
          percent: ((estimate.usage || 0) / (estimate.quota || 1)) * 100
        };
      }
      return null;
    } catch (error) {
      console.warn('Could not get storage info:', error);
      return null;
    }
  }

  // Check if IndexedDB is available and working
  async testConnection(): Promise<boolean> {
    try {
      await this.open();
      // Try a simple operation
      await this.characters.limit(1).toArray();
      return true;
    } catch (error) {
      console.warn('IndexedDB test failed:', error);
      return false;
    }
  }

  // Get cache statistics
  async getCacheStats() {
    try {
      const [charCount, pairCount, userPairCount, universeCount, storageInfo] = await Promise.all([
        this.characters.count(),
        this.pairs.count(),
        this.userSeenPairs.count(),
        this.universes.count(),
        this.getStorageInfo()
      ]);

      return {
        characters: charCount,
        pairs: pairCount,
        userPairs: userPairCount,
        universes: universeCount,
        storage: storageInfo
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return null;
    }
  }

  // Limit database size by removing oldest entries
  async limitDatabaseSize(maxCharacters = 1000, maxPairs = 5000) {
    try {
      // Limit characters
      const charCount = await this.characters.count();
      if (charCount > maxCharacters) {
        const toDelete = charCount - maxCharacters;
        const oldestChars = await this.characters
          .orderBy('cached_at')
          .limit(toDelete)
          .toArray();

        await this.characters.bulkDelete(oldestChars.map(c => c.id));
        console.log(`🗑️ Removed ${toDelete} oldest characters`);
      }

      // Limit pairs
      const pairCount = await this.pairs.count();
      if (pairCount > maxPairs) {
        const toDelete = pairCount - maxPairs;
        const oldestPairs = await this.pairs
          .orderBy('seen_at')
          .limit(toDelete)
          .toArray();

        await this.pairs.bulkDelete(oldestPairs.map(p => [p.hash, p.scope]));
        console.log(`🗑️ Removed ${toDelete} oldest pairs`);
      }
    } catch (error) {
      console.error('Size limit enforcement failed:', error);
    }
  }
}

export const db = new KibakiDB();

// Initialize database and add global debug helpers in development
if (import.meta.env.DEV) {
  db.open().catch(console.error);

  // Global debug helpers
  if (typeof window !== 'undefined') {
    (window as any).kibakiStorage = {
      // Inspect database contents
      inspectDB: async () => {
        const chars = await db.characters.orderBy('cached_at').reverse().limit(20).toArray();
        const pairs = await db.pairs.orderBy('seen_at').reverse().limit(20).toArray();
        const universes = await db.universes.toArray();

        console.group('📊 KibakiDB Contents');
        console.log('Characters (last 20):', chars);
        console.log('Pairs (last 20):', pairs);
        console.log('Universes:', universes);
        console.groupEnd();

        return { chars, pairs, universes };
      },

      // Check storage usage
      checkQuota: async () => {
        const info = await db.getStorageInfo();
        const stats = await db.getCacheStats();
        console.log('💾 Storage Info:', info);
        console.log('📈 Cache Stats:', stats);
        return { info, stats };
      },

      // Force cleanup
      cleanCache: async () => {
        console.log('🧹 Starting manual cleanup...');
        await db.cleanExpired();
        await db.limitDatabaseSize();
        console.log('✅ Cleanup complete');
      },

      // Clear all data
      clearAll: async () => {
        console.log('🗑️ Clearing all cache data...');
        await db.delete();
        await db.open();
        console.log('✅ Cache cleared');
      },

      // Test IndexedDB performance
      perfTest: async () => {
        console.log('⏱️ Running performance test...');
        const start = performance.now();

        // Create test characters
        const testChars: CachedCharacter[] = Array.from({ length: 100 }, (_, i) => ({
          id: 999000 + i,
          name: `Test Character ${i}`,
          slug: `test-${i}`,
          description: 'Test character for performance testing',
          image_url: null,
          elo: 1000 + i,
          wins: i,
          losses: i,
          cached_at: Date.now(),
          ttl: 3600000
        }));

        await db.characters.bulkPut(testChars);
        const writeTime = performance.now() - start;

        const readStart = performance.now();
        await db.characters.where('id').between(999000, 999099).toArray();
        const readTime = performance.now() - readStart;

        // Cleanup test data
        await db.characters.where('id').between(999000, 999099).delete();

        console.log(`📊 Performance: Write ${writeTime.toFixed(2)}ms, Read ${readTime.toFixed(2)}ms`);
        return { writeTime, readTime };
      }
    };

    console.log('🔧 KibakiDB debug helpers available on window.kibakiStorage');
  }
}
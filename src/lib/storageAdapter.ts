import Dexie from 'dexie';
import { db, type CachedCharacter, type CachedUniverse } from './kibakiDB';
import type { CharacterRow } from './duels';
import {
  IDS_BASE,
  PAIRS_BASE,
  getAllCharacterIds as legacyGetCharacterIds,
  getUsedPairs as legacyGetUsedPairs,
  addUsedPair as legacyAddUsedPair,
  clearUsedPairs as legacyClearUsedPairs
} from './duels';

// Storage adapter interface
export interface StorageAdapter {
  isAvailable(): Promise<boolean>;
  getCharacterIds(scope: string): Promise<number[]>;
  setCharacterIds(scope: string, ids: number[]): Promise<void>;
  getPairHashes(scope: string): Promise<string[]>;
  addPairHash(scope: string, hash: string): Promise<void>;
  clearPairHashes(scope: string): Promise<void>;
  getCharacter(id: number): Promise<CachedCharacter | null>;
  setCharacter(character: CharacterRow, universeId?: number): Promise<void>;
  getCharacters(ids: number[]): Promise<CachedCharacter[]>;
  cacheImage(characterId: number, imageUrl: string, blob: Blob): Promise<void>;
  getImageBlob(characterId: number): Promise<Blob | null>;
  getUniverses(): Promise<CachedUniverse[]>;
  setUniverses(universes: any[]): Promise<void>;
  clear(): Promise<void>;
  cleanup(): Promise<void>;
}

// IndexedDB implementation
class IndexedDBAdapter implements StorageAdapter {
  private isDbReady = false;

  constructor() {
    this.initDB();
  }

  private async initDB() {
    try {
      await db.open();
      this.isDbReady = await db.testConnection();
      if (this.isDbReady && import.meta.env.DEV) {
        console.log('✅ IndexedDB initialized successfully');
      }
    } catch (error) {
      console.warn('IndexedDB initialization failed:', error);
      this.isDbReady = false;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isDbReady) {
      await this.initDB();
    }
    return this.isDbReady && typeof indexedDB !== 'undefined';
  }

  async getCharacterIds(scope: string): Promise<number[]> {
    try {
      if (!(await this.isAvailable())) return [];

      let characters: CachedCharacter[];
      const now = Date.now();

      if (scope === 'global') {
        characters = await db.characters
          .where('cached_at')
          .above(now - 3600000) // Only non-expired
          .toArray();
      } else {
        // Try to parse scope as universe ID, fallback to slug lookup
        let universeId: number | undefined;
        const parsedId = parseInt(scope);
        if (!isNaN(parsedId)) {
          universeId = parsedId;
        } else {
          // Look up universe by slug
          const universe = await db.universes.where('slug').equals(scope).first();
          universeId = universe?.id;
        }

        if (universeId !== undefined) {
          characters = await db.characters
            .where('[universe_id+cached_at]')
            .between([universeId, now - 3600000], [universeId, now])
            .toArray();
        } else {
          characters = [];
        }
      }

      const ids = characters.map(c => c.id);
      if (import.meta.env.DEV && ids.length > 0) {
        console.log(`📊 Retrieved ${ids.length} character IDs from IndexedDB for scope: ${scope}`);
      }

      return ids;
    } catch (error) {
      console.warn('IndexedDB getCharacterIds error:', error);
      return [];
    }
  }

  async setCharacterIds(scope: string, ids: number[]): Promise<void> {
    // This becomes a no-op in IndexedDB since we store full character objects
    // The IDs are implicitly available through the characters table
  }

  async getPairHashes(scope: string): Promise<string[]> {
    try {
      if (!(await this.isAvailable())) return [];

      const pairs = await db.pairs
        .where('scope')
        .equals(scope)
        .filter((p: any) => (Date.now() - p.seen_at) < p.ttl)
        .toArray();

      return pairs.map(p => p.hash);
    } catch (error) {
      console.warn('IndexedDB getPairHashes error:', error);
      return [];
    }
  }

  async addPairHash(scope: string, hash: string): Promise<void> {
    try {
      if (!(await this.isAvailable())) return;

      await db.pairs.put({
        hash,
        scope,
        seen_at: Date.now(),
        ttl: 86400000 // 24 hours
      });

      // Limit pairs per scope to prevent unlimited growth
      const pairCount = await db.pairs.where('scope').equals(scope).count();
      if (pairCount > 1000) {
        const allPairs = await db.pairs
          .where('scope')
          .equals(scope)
          .toArray();

        // Sort by seen_at and get oldest
        const oldestPairs = allPairs
          .sort((a, b) => a.seen_at - b.seen_at)
          .slice(0, pairCount - 1000);

        if (oldestPairs.length > 0) {
          await db.pairs.bulkDelete(oldestPairs.map((p: any) => [p.hash, p.scope]));
        }
      }
    } catch (error) {
      console.warn('IndexedDB addPairHash error:', error);
    }
  }

  async clearPairHashes(scope: string): Promise<void> {
    try {
      if (!(await this.isAvailable())) return;

      await db.pairs.where('scope').equals(scope).delete();
      if (import.meta.env.DEV) {
        console.log(`🗑️ Cleared pair hashes for scope: ${scope}`);
      }
    } catch (error) {
      console.warn('IndexedDB clearPairHashes error:', error);
    }
  }

  async getCharacter(id: number): Promise<CachedCharacter | null> {
    try {
      if (!(await this.isAvailable())) return null;

      const character = await db.characters.get(id);
      if (character && (Date.now() - character.cached_at) < character.ttl) {
        return character;
      }
      return null;
    } catch (error) {
      console.warn('IndexedDB getCharacter error:', error);
      return null;
    }
  }

  async setCharacter(character: CharacterRow, universeId?: number): Promise<void> {
    try {
      if (!(await this.isAvailable())) return;

      const cachedChar: CachedCharacter = {
        ...character,
        universe_id: universeId,
        cached_at: Date.now(),
        ttl: 3600000 // 1 hour
      };

      await db.characters.put(cachedChar);
    } catch (error) {
      console.warn('IndexedDB setCharacter error:', error);
    }
  }

  async getCharacters(ids: number[]): Promise<CachedCharacter[]> {
    try {
      if (!(await this.isAvailable())) return [];

      const characters = await db.characters.bulkGet(ids);
      const now = Date.now();

      return characters.filter((char): char is CachedCharacter =>
        char !== undefined && (now - char.cached_at) < char.ttl
      );
    } catch (error) {
      console.warn('IndexedDB getCharacters error:', error);
      return [];
    }
  }

  async cacheImage(characterId: number, imageUrl: string, blob: Blob): Promise<void> {
    try {
      if (!(await this.isAvailable())) return;

      const character = await db.characters.get(characterId);
      if (character && character.image_url === imageUrl) {
        character.image_blob = blob;
        await db.characters.put(character);

        if (import.meta.env.DEV) {
          console.log(`🖼️ Cached image for character ${characterId} (${blob.size} bytes)`);
        }
      }
    } catch (error) {
      console.warn('IndexedDB cacheImage error:', error);
    }
  }

  async getImageBlob(characterId: number): Promise<Blob | null> {
    try {
      if (!(await this.isAvailable())) return null;

      const character = await db.characters.get(characterId);
      return character?.image_blob || null;
    } catch (error) {
      console.warn('IndexedDB getImageBlob error:', error);
      return null;
    }
  }

  async getUniverses(): Promise<CachedUniverse[]> {
    try {
      if (!(await this.isAvailable())) return [];

      const universes = await db.universes
        .where('cached_at')
        .above(Date.now() - 3600000) // Only non-expired
        .toArray();

      return universes;
    } catch (error) {
      console.warn('IndexedDB getUniverses error:', error);
      return [];
    }
  }

  async setUniverses(universes: any[]): Promise<void> {
    try {
      if (!(await this.isAvailable())) return;

      const cachedUniverses: CachedUniverse[] = universes.map(u => ({
        id: u.id,
        slug: u.slug,
        name: u.name,
        cached_at: Date.now(),
        ttl: 3600000 // 1 hour
      }));

      await db.universes.bulkPut(cachedUniverses);
    } catch (error) {
      console.warn('IndexedDB setUniverses error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      if (!(await this.isAvailable())) return;

      await Promise.all([
        db.characters.clear(),
        db.pairs.clear(),
        db.userSeenPairs.clear(),
        db.universes.clear()
      ]);

      if (import.meta.env.DEV) {
        console.log('🗑️ IndexedDB cache cleared');
      }
    } catch (error) {
      console.warn('IndexedDB clear error:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (!(await this.isAvailable())) return;

      await db.cleanExpired();
      await db.limitDatabaseSize();
    } catch (error) {
      console.warn('IndexedDB cleanup error:', error);
    }
  }
}

// localStorage fallback implementation
class LocalStorageAdapter implements StorageAdapter {
  private available: boolean | null = null;

  async isAvailable(): Promise<boolean> {
    if (this.available !== null) return this.available;

    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      this.available = true;
      return true;
    } catch {
      this.available = false;
      return false;
    }
  }

  async getCharacterIds(scope: string): Promise<number[]> {
    try {
      if (!(await this.isAvailable())) return [];

      // Use the existing localStorage logic
      return await legacyGetCharacterIds(scope);
    } catch (error) {
      console.warn('localStorage getCharacterIds error:', error);
      return [];
    }
  }

  async setCharacterIds(scope: string, ids: number[]): Promise<void> {
    try {
      if (!(await this.isAvailable())) return;

      const key = `${IDS_BASE}::${scope}`;
      const data = { ids, ts: Date.now() };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('localStorage setCharacterIds error:', error);
    }
  }

  async getPairHashes(scope: string): Promise<string[]> {
    try {
      if (!(await this.isAvailable())) return [];

      return Array.from(legacyGetUsedPairs(scope));
    } catch (error) {
      console.warn('localStorage getPairHashes error:', error);
      return [];
    }
  }

  async addPairHash(scope: string, hash: string): Promise<void> {
    try {
      if (!(await this.isAvailable())) return;

      legacyAddUsedPair(hash, scope);
    } catch (error) {
      console.warn('localStorage addPairHash error:', error);
    }
  }

  async clearPairHashes(scope: string): Promise<void> {
    try {
      if (!(await this.isAvailable())) return;

      legacyClearUsedPairs(scope);
    } catch (error) {
      console.warn('localStorage clearPairHashes error:', error);
    }
  }

  async getCharacter(id: number): Promise<CachedCharacter | null> {
    // localStorage doesn't cache full character objects
    return null;
  }

  async setCharacter(character: CharacterRow, universeId?: number): Promise<void> {
    // localStorage doesn't cache full character objects
  }

  async getCharacters(ids: number[]): Promise<CachedCharacter[]> {
    // localStorage doesn't cache full character objects
    return [];
  }

  async cacheImage(characterId: number, imageUrl: string, blob: Blob): Promise<void> {
    // localStorage can't cache binary data efficiently
  }

  async getImageBlob(characterId: number): Promise<Blob | null> {
    // localStorage can't cache binary data
    return null;
  }

  async getUniverses(): Promise<CachedUniverse[]> {
    // localStorage doesn't cache universe data
    return [];
  }

  async setUniverses(universes: any[]): Promise<void> {
    // localStorage doesn't cache universe data
  }

  async clear(): Promise<void> {
    try {
      if (!(await this.isAvailable())) return;

      const keys = Object.keys(localStorage).filter(key =>
        key.startsWith('kibaki_') || key.startsWith('KibakiDB')
      );

      keys.forEach(key => localStorage.removeItem(key));

      if (import.meta.env.DEV) {
        console.log('🗑️ localStorage cache cleared');
      }
    } catch (error) {
      console.warn('localStorage clear error:', error);
    }
  }

  async cleanup(): Promise<void> {
    // localStorage cleanup is handled by the existing logic
  }
}

// Memory-only fallback for when no storage is available
class MemoryAdapter implements StorageAdapter {
  private characters = new Map<number, CachedCharacter>();
  private pairs = new Map<string, Set<string>>();
  private universes: CachedUniverse[] = [];

  async isAvailable(): Promise<boolean> {
    return true; // Memory is always available
  }

  async getCharacterIds(scope: string): Promise<number[]> {
    const now = Date.now();
    return Array.from(this.characters.values())
      .filter(char => {
        if ((now - char.cached_at) > char.ttl) return false;
        if (scope === 'global') return true;
        return char.universe_id?.toString() === scope;
      })
      .map(char => char.id);
  }

  async setCharacterIds(scope: string, ids: number[]): Promise<void> {
    // No-op for memory adapter
  }

  async getPairHashes(scope: string): Promise<string[]> {
    return Array.from(this.pairs.get(scope) || []);
  }

  async addPairHash(scope: string, hash: string): Promise<void> {
    if (!this.pairs.has(scope)) {
      this.pairs.set(scope, new Set());
    }
    this.pairs.get(scope)!.add(hash);
  }

  async clearPairHashes(scope: string): Promise<void> {
    this.pairs.delete(scope);
  }

  async getCharacter(id: number): Promise<CachedCharacter | null> {
    const char = this.characters.get(id);
    if (char && (Date.now() - char.cached_at) < char.ttl) {
      return char;
    }
    return null;
  }

  async setCharacter(character: CharacterRow, universeId?: number): Promise<void> {
    const cachedChar: CachedCharacter = {
      ...character,
      universe_id: universeId,
      cached_at: Date.now(),
      ttl: 3600000
    };
    this.characters.set(character.id, cachedChar);
  }

  async getCharacters(ids: number[]): Promise<CachedCharacter[]> {
    const now = Date.now();
    return ids
      .map(id => this.characters.get(id))
      .filter((char): char is CachedCharacter =>
        char !== undefined && (now - char.cached_at) < char.ttl
      );
  }

  async cacheImage(characterId: number, imageUrl: string, blob: Blob): Promise<void> {
    const char = this.characters.get(characterId);
    if (char) {
      char.image_blob = blob;
    }
  }

  async getImageBlob(characterId: number): Promise<Blob | null> {
    return this.characters.get(characterId)?.image_blob || null;
  }

  async getUniverses(): Promise<CachedUniverse[]> {
    const now = Date.now();
    return this.universes.filter(u => (now - u.cached_at) < u.ttl);
  }

  async setUniverses(universes: any[]): Promise<void> {
    this.universes = universes.map(u => ({
      id: u.id,
      slug: u.slug,
      name: u.name,
      cached_at: Date.now(),
      ttl: 3600000
    }));
  }

  async clear(): Promise<void> {
    this.characters.clear();
    this.pairs.clear();
    this.universes = [];
  }

  async cleanup(): Promise<void> {
    const now = Date.now();

    // Clean expired characters
    for (const [id, char] of this.characters) {
      if ((now - char.cached_at) > char.ttl) {
        this.characters.delete(id);
      }
    }

    // Clean expired universes
    this.universes = this.universes.filter(u => (now - u.cached_at) < u.ttl);
  }
}

// Factory function to get the best available storage adapter
let _cachedAdapter: StorageAdapter | null = null;

export async function getStorageAdapter(): Promise<StorageAdapter> {
  if (_cachedAdapter) return _cachedAdapter;

  const idbAdapter = new IndexedDBAdapter();
  if (await idbAdapter.isAvailable()) {
    _cachedAdapter = idbAdapter;
    if (import.meta.env.DEV) {
      console.log('✅ Using IndexedDB storage adapter');
    }
    return idbAdapter;
  }

  const lsAdapter = new LocalStorageAdapter();
  if (await lsAdapter.isAvailable()) {
    _cachedAdapter = lsAdapter;
    if (import.meta.env.DEV) {
      console.warn('⚠️ Falling back to localStorage (limited capacity)');
    }
    return lsAdapter;
  }

  _cachedAdapter = new MemoryAdapter();
  if (import.meta.env.DEV) {
    console.warn('⚠️ Using memory-only storage (data will not persist)');
  }
  return _cachedAdapter;
}

// Reset cached adapter (for testing)
export function resetStorageAdapter() {
  _cachedAdapter = null;
}
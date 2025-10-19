import { supabase } from '@/lib/supabaseClient';

// Scoped LocalStorage keys
export const SCOPE_KEY = 'kibaki_duel_scope_v1' as const; // UI reads/writes this
export const IDS_BASE = 'kibaki_char_ids_v1' as const; // stores { ids:number[], ts:number }
export const PAIRS_BASE = 'kibaki_pair_hashes_v1' as const; // stores string[] of "minId:maxId"

const keyFor = (base: string, scope?: string) => `${base}::${(scope || 'global')}`;

// Types
export type CharacterRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  elo: number;
  wins: number;
  losses: number;
  universe: { id: number; slug: string; name: string };
};

export type DuelPair = {
  left: CharacterRow;
  right: CharacterRow;
  hash: string;
};

// Utils
const ONE_HOUR_MS = 60 * 60 * 1000;

function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !('localStorage' in window)) return false;
    const testKey = '__ls_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function readLocalStorageJson<T>(key: string): T | null {
  if (!isLocalStorageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeLocalStorageJson<T>(key: string, value: T): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore write failures (quota, etc.)
  }
}

// 1) Get all character ids with caching (scoped)
export async function getAllCharacterIds(scope?: string, forceRefresh = false): Promise<number[]> {
  const idsKey = keyFor(IDS_BASE, scope);
  // Try cache
  if (!forceRefresh) {
    const cached = readLocalStorageJson<{ ids: number[]; ts: number }>(idsKey);
    if (cached && Array.isArray(cached.ids) && typeof cached.ts === 'number') {
      const isFresh = Date.now() - cached.ts < ONE_HOUR_MS;
      if (isFresh) {
        if (import.meta.env?.DEV) {
          console.debug('[duels] cache HIT ids', cached.ids.length);
        }
        return cached.ids;
      }
    }
  }

  // Fetch from Supabase
  let universeId: number | undefined = undefined;
  const slug = (scope || 'global');
  if (slug && slug !== 'global') {
    const { data: u, error: ue } = await supabase
      .from('univers')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (ue) throw new Error(`Failed to resolve universe: ${ue.message}`);
    universeId = u?.id;
    if (universeId === undefined) {
      // Unknown slug => treat as empty scope
      writeLocalStorageJson(idsKey, { ids: [], ts: Date.now() });
      return [];
    }
  }

  let query = supabase
    .from('characters')
    .select('id')
    .order('id', { ascending: true });

  if (universeId !== undefined) {
    query = query.eq('universe_id', universeId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch character ids: ${error.message}`);
  }

  const ids = (data ?? [])
    .map((row) => (typeof (row as any).id === 'number' ? (row as any).id as number : Number((row as any).id)))
    .filter((n) => Number.isFinite(n)) as number[];

  // Cache regardless of count; caller decides behavior when < 2
  writeLocalStorageJson(idsKey, { ids, ts: Date.now() });
  if (import.meta.env?.DEV) {
    console.debug('[duels] cache MISS ids fetched', ids.length);
  }
  return ids;
}

// 2) Read used pairs as Set (scoped)
export function getUsedPairs(scope?: string): Set<string> {
  const pairsKey = keyFor(PAIRS_BASE, scope);
  const arr = readLocalStorageJson<string[]>(pairsKey);
  if (!arr || !Array.isArray(arr)) return new Set<string>();
  return new Set<string>(arr.filter((s) => typeof s === 'string'));
}

// 3) Add used pair (keep at most last 500 entries) (scoped)
export function addUsedPair(hash: string, scope?: string): void {
  if (typeof hash !== 'string' || !hash.includes(':')) return;
  const pairsKey = keyFor(PAIRS_BASE, scope);
  const arr = readLocalStorageJson<string[]>(pairsKey) ?? [];
  // Remove existing occurrences to move it to the end (most recent)
  const filtered = arr.filter((h) => h !== hash && typeof h === 'string');
  filtered.push(hash);
  const trimmed = filtered.slice(-500);
  writeLocalStorageJson(pairsKey, trimmed);
  if (import.meta.env?.DEV) {
    console.debug('[duels] addUsedPair size', trimmed.length);
  }
}

// 4) Clear used pairs (scoped)
export function clearUsedPairs(scope?: string): void {
  if (!isLocalStorageAvailable()) return;
  try {
    const pairsKey = keyFor(PAIRS_BASE, scope);
    window.localStorage.removeItem(pairsKey);
  } catch {
    // ignore
  }
}

// 5) Normalized pair hash
export function makePairHash(a: number, b: number): string {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return `${min}:${max}`;
}

// 6) Pick a random distinct pair, avoiding already-used pairs when possible
export function pickRandomDistinctPair(
  ids: number[],
  avoid: Set<string>,
  maxTries = 25
): [number, number, string] {
  if (!Array.isArray(ids) || ids.length < 2) {
    throw new Error('Need at least 2 character ids to pick a pair');
  }

  const n = ids.length;
  const getRandomIndex = () => Math.floor(Math.random() * n);

  for (let attempt = 0; attempt < maxTries; attempt++) {
    let i = getRandomIndex();
    let j = getRandomIndex();
    if (i === j) {
      // try once more quickly to avoid same index
      j = (j + 1) % n;
      if (i === j) continue;
    }
    const leftId = ids[i];
    const rightId = ids[j];
    const hash = makePairHash(leftId, rightId);
    if (!avoid.has(hash)) {
      if (import.meta.env?.DEV) {
        console.debug('[duels] pick', { leftId, rightId, hash });
      }
      return [leftId, rightId, hash];
    }
  }

  // All attempts failed due to avoidance; ignore avoid and return any fresh pair
  let i = 0;
  let j = 0;
  while (i === j) {
    i = Math.floor(Math.random() * n);
    j = Math.floor(Math.random() * n);
  }
  const leftId = ids[i];
  const rightId = ids[j];
  const hash = makePairHash(leftId, rightId);
  return [leftId, rightId, hash];
}

// 7) Load pair details from Supabase
export async function loadPairDetails(
  leftId: number,
  rightId: number
): Promise<{ left: CharacterRow; right: CharacterRow }> {
  const ids = [leftId, rightId];

  const { data, error } = await supabase
    .from('characters')
    .select('id, name, slug, description, image_url, elo, wins, losses, universe:univers!inner ( id, slug, name )')
    .in('id', ids);

  if (error) {
    throw new Error(`Failed to fetch pair details: ${error.message}`);
  }

  const rows = (data ?? []) as CharacterRow[];
  const left = rows.find((r) => r.id === leftId);
  const right = rows.find((r) => r.id === rightId);

  if (!left || !right) {
    throw new Error('One or both characters not found');
  }

  return { left, right };
}



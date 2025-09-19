import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { TopCharacter, Universe } from '@/lib/top';
import { fetchTopCharacters, fetchUniverses, fetchRankMap } from '@/lib/top';
import LeaderboardList from '@/components/LeaderboardList';

export default function LeaderboardIsland() {
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [active, setActive] = useState<string>('global');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<TopCharacter[]>([]);
  const [rankMap, setRankMap] = useState<Map<number, number>>(new Map());
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 25;
  const seenRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef(false);

  async function loadTop({ reset = false }: { reset?: boolean } = {}) {
    setLoading(true);
    setError(null);
    if (import.meta.env?.DEV) console.debug('[top] loadTop reset=', reset, 'active=', active);
    const universeSlug = (active && active !== 'global') ? active : undefined;
    const q = { universeSlug, search: search.trim() || undefined, limit: PAGE_SIZE, offset: reset ? 0 : offset };
    try {
      const data = await fetchTopCharacters(q);
      const fresh = data.filter((d) => !seenRef.current.has(d.id));
      fresh.forEach((d) => seenRef.current.add(d.id));
      if (reset) {
        setItems(fresh);
        setOffset(fresh.length);
      } else {
        setItems((prev) => [...prev, ...fresh]);
        setOffset((prev) => prev + fresh.length);
      }
      setHasMore(fresh.length === PAGE_SIZE);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const list = await fetchUniverses();
        if (cancelled) return;
        setUniverses(list);
      } catch (e) {
        // ignore universo load errors; tabs will just have Global
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when tab/search changes, but skip very first render (handled by mount effect)
  useEffect(() => {
    if (!mountedRef.current) return; // skip first render
    setItems([]);
    setOffset(0);
    setHasMore(true);
    seenRef.current = new Set();
    loadTop({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, search]);

  // Ensure initial mount loads first page deterministically
  useEffect(() => {
    mountedRef.current = true;
    setItems([]);
    setOffset(0);
    setHasMore(true);
    loadTop({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTabClick = (slug: string) => {
    setActive(slug);
  };

  const onChangeSearch: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const value = e.target.value;
    setSearch(value);
  };


  // Load rank map when scope changes (global vs universe). Do not depend on search.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const universeSlug = active === 'global' ? undefined : active;
        const rm = await fetchRankMap({ universeSlug, max: 2000 });
        if (!cancelled) setRankMap(rm);
      } catch (e) {
        if (import.meta.env?.DEV) console.warn('rankMap error', e);
        if (!cancelled) setRankMap(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  const tabs = useMemo(() => {
    return [{ slug: 'global', name: 'Global' }, ...universes.map((u) => ({ slug: u.slug, name: u.name }))];
  }, [universes]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Leaderboards</h1>
        <p className="text-sm text-gray-600">Top personnages, classés par ELO.</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="no-scrollbar -mx-1 flex min-w-0 gap-2 overflow-x-auto px-1">
          {tabs.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => onTabClick(t.slug)}
              className={`shrink-0 rounded-full px-3 py-1 text-sm ${
                active === t.slug ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={t.name}
            >
              {t.slug === 'global' ? 'Global' : t.slug}
            </button>
          ))}
        </div>

        <div className="relative w-64 max-w-full">
          <input
            type="text"
            value={search}
            onChange={onChangeSearch}
            placeholder="Rechercher un personnage…"
            className="w-full rounded-full border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 4.243 11.957l3.775 3.775a.75.75 0 1 0 1.06-1.06l-3.775-3.776A6.75 6.75 0 0 0 10.5 3.75Zm-5.25 6.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-200" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : (
        <>
          <LeaderboardList items={items} rankMap={rankMap} />
          {hasMore && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => loadTop()}
                disabled={loading}
                className={`w-full rounded-2xl border px-4 py-2 text-sm ${
                  loading ? 'cursor-not-allowed bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {loading ? 'Chargement…' : 'Charger plus'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}



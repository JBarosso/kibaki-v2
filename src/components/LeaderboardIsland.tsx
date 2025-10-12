import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { TopCharacter, Universe } from '@/lib/top';
import { fetchTopCharacters, fetchUniverses, fetchRankMap } from '@/lib/top';
import LeaderboardList from '@/components/LeaderboardList';
import { I18nProvider, useI18n, type Lang } from '@/i18n';

type LeaderboardIslandProps = {
  lang: Lang;
  heading: string;
  subtitle: string;
};

export default function LeaderboardIsland(props: LeaderboardIslandProps) {
  return (
    <I18nProvider lang={props.lang}>
      <LeaderboardIslandInner {...props} />
    </I18nProvider>
  );
}

function LeaderboardIslandInner({ heading, subtitle }: LeaderboardIslandProps) {
  const { t, getUniverseLabel } = useI18n();
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

  useEffect(() => {
    if (!mountedRef.current) return; // skip first render
    setItems([]);
    setOffset(0);
    setHasMore(true);
    seenRef.current = new Set();
    loadTop({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, search]);

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
    return [{ slug: 'global', name: t('top.globalTab') }, ...universes.map((u) => ({ slug: u.slug, name: getUniverseLabel(u.slug) }))];
  }, [universes, getUniverseLabel, t]);

  const searchPlaceholder = t('actions.searchPlaceholder');
  const loadingLabel = t('top.loading');
  const loadMoreLabel = t('top.loadMore');

  return (
    <div className="leaderboard-island">
      <div>
        <h1 className="leaderboard-island__heading">{heading}</h1>
        <p className="leaderboard-island__subtitle">{subtitle}</p>
      </div>

      <div className="leaderboard-island__controls">
        <div className="leaderboard-island__tabs">
          {tabs.map((tItem) => (
            <button
              key={tItem.slug}
              type="button"
              onClick={() => onTabClick(tItem.slug)}
              className={`leaderboard-island__tab ${
                active === tItem.slug ? 'leaderboard-island__tab--active' : ''
              }`}
              title={tItem.name}
            >
              {tItem.name}
            </button>
          ))}
        </div>

        <div className="leaderboard-island__search-wrapper">
          <input
            type="text"
            value={search}
            onChange={onChangeSearch}
            placeholder={searchPlaceholder}
            className="leaderboard-island__search-input"
          />
          <div className="leaderboard-island__search-icon-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="leaderboard-island__search-icon">
              <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 4.243 11.957l3.775 3.775a.75.75 0 1 0 1.06-1.06l-3.775-3.776A6.75 6.75 0 0 0 10.5 3.75Zm-5.25 6.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="leaderboard-island__skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="leaderboard-island__skeleton-item" />
          ))}
        </div>
      ) : error ? (
        <div className="leaderboard-island__error">{error}</div>
      ) : (
        <>
          <LeaderboardList items={items} rankMap={rankMap} />
          {hasMore && (
            <div className="leaderboard-island__load-more">
              <button
                type="button"
                onClick={() => loadTop()}
                disabled={loading}
                className={`leaderboard-island__load-more-button ${
                  loading ? 'leaderboard-island__load-more-button--disabled' : ''
                }`}
              >
                {loading ? loadingLabel : loadMoreLabel}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

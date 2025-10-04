import { useEffect, useMemo, useState } from 'react';

export type Lang = 'fr' | 'en';

type MinimalChar = {
  slug?: string | null;
  name?: string | null;
  description?: string | null;
};

const dict = {
  ui: {
    en: (await import('./en.json')).default,
    fr: (await import('./fr.json')).default,
  },
  universes: {
    en: (await import('./universes.en.json')).default,
    fr: (await import('./universes.fr.json')).default,
  },
  characters: {
    en: (await import('./characters.en.json')).default,
    fr: (await import('./characters.fr.json')).default,
  },
} as const;

function normalizeLang(input: string | null | undefined): Lang | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('fr')) return 'fr';
  return null;
}

function getFromDict<T extends Record<string, any>>(table: T, key: string) {
  if (!table || typeof table !== 'object') return undefined;
  const parts = key.split('.').filter(Boolean);
  let current: any = table;
  for (const part of parts) {
    current = current?.[part];
    if (current === undefined || current === null) {
      return undefined;
    }
  }
  return current;
}

export function resolveLang(Astro: { request?: Request; cookies?: any }): Lang {
  const cookieEntry =
    typeof Astro?.cookies?.get === 'function' ? Astro.cookies.get('lang') : undefined;
  const cookieValue = typeof cookieEntry === 'string' ? cookieEntry : cookieEntry?.value;

  const headerLang = Astro?.request?.headers?.get?.('accept-language') ?? undefined;

  return normalizeLang(cookieValue) ?? normalizeLang(headerLang) ?? 'fr';
}

function translate(lang: Lang, key: string): string {
  const result = getFromDict(dict.ui[lang] as Record<string, any>, key);
  if (typeof result === 'string') return result;
  return key;
}

export function tServer(lang: Lang, key: string) {
  return translate(lang, key);
}

export function getUniverseLabel(slug: string | null | undefined, lang: Lang) {
  if (!slug) return '';
  const d = dict.universes[lang] as Record<string, { name: string }>;
  return d?.[slug]?.name ?? slug;
}

export function getCharacterText(c: MinimalChar | null | undefined, lang: Lang) {
  const slug = (c?.slug ?? '') as string;
  const baseName = c?.name ?? '';
  const baseDesc = c?.description ?? '';
  if (!slug) return { name: baseName, description: baseDesc };
  const d = dict.characters[lang] as Record<string, { name?: string; description?: string }>;
  const o = d?.[slug];
  return {
    name: o?.name ?? baseName,
    description: o?.description ?? baseDesc,
  };
}

export function useI18n(initialLang?: Lang) {
  const [langState, setLangState] = useState<Lang>(() => initialLang ?? 'fr');

  useEffect(() => {
    if (initialLang && initialLang !== langState) {
      setLangState(initialLang);
      return;
    }

    if (typeof document !== 'undefined') {
      const docLang = normalizeLang(document.documentElement?.lang);
      if (docLang && docLang !== langState) {
        setLangState(docLang);
      }
    }
  }, [initialLang, langState]);

  return useMemo(() => {
    const lang = initialLang ?? langState;
    return {
      lang,
      setLang: setLangState,
      t: (key: string, overrideLang?: Lang) => translate(overrideLang ?? lang, key),
      getUniverseLabel: (slug: string | null | undefined, overrideLang?: Lang) =>
        getUniverseLabel(slug, overrideLang ?? lang),
      getCharacterText: (c: MinimalChar | null | undefined, overrideLang?: Lang) =>
        getCharacterText(c, overrideLang ?? lang),
    };
  }, [initialLang, langState]);
}

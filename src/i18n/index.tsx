import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AstroGlobal } from 'astro';
import enUI from './en.json';
import frUI from './fr.json';
import universesEn from './universes.en.json';
import universesFr from './universes.fr.json';
import charactersEn from './characters.en.json';
import charactersFr from './characters.fr.json';

export type Lang = 'en' | 'fr';

type UIDictionary = typeof enUI;

type CharacterOverlay = Record<string, { name?: string; description?: string } | undefined>;

type UniverseOverlay = Record<string, { name?: string } | undefined>;

type CharacterInput = { slug: string; name: string; description?: string | null };

type TranslateParams = Record<string, string | number>;

const UI_DICTIONARIES: Record<Lang, UIDictionary> = { en: enUI, fr: frUI };
const UNIVERSE_DICTIONARIES: Record<Lang, UniverseOverlay> = { en: universesEn, fr: universesFr };
const CHARACTER_DICTIONARIES: Record<Lang, CharacterOverlay> = { en: charactersEn, fr: charactersFr };

export const LANG_COOKIE_NAME = 'kibaki_lang';
export const LANG_STORAGE_KEY = 'kibaki_lang';

const DEFAULT_LANG: Lang = 'en';

type ResolveLangInput = {
  url?: URL;
  req?: Request | null;
  cookie?: string | null | undefined;
};

function lookup(dict: UIDictionary, key: string): string | undefined {
  const parts = key.split('.');
  let current: any = dict;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

function format(str: string, params?: TranslateParams): string {
  if (!params) return str;
  return Object.keys(params).reduce((acc, key) => {
    const value = params[key];
    return acc.replaceAll(`{${key}}`, String(value));
  }, str);
}

function translate(lang: Lang, key: string, params?: TranslateParams): string {
  const primary = lookup(UI_DICTIONARIES[lang], key);
  if (primary) return format(primary, params);
  const fallback = lookup(UI_DICTIONARIES.en, key);
  if (fallback) return format(fallback, params);
  return key;
}

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'fr';
}

export function detectFromHeader(req: Request | null | undefined): Lang {
  const header = req?.headers?.get('accept-language');
  if (!header) return DEFAULT_LANG;
  const segments = header.split(',').map((segment) => segment.trim().split(';')[0]);
  for (const segment of segments) {
    if (!segment) continue;
    if (segment.toLowerCase().startsWith('fr')) return 'fr';
    if (segment.toLowerCase().startsWith('en')) return 'en';
  }
  return DEFAULT_LANG;
}

export function resolveLang({ url, req, cookie }: ResolveLangInput): Lang {
  const queryLang = url?.searchParams?.get('lang');
  if (isLang(queryLang)) {
    return queryLang;
  }
  if (isLang(cookie)) {
    return cookie;
  }
  return detectFromHeader(req);
}

export function tServer(lang: Lang, key: string, params?: TranslateParams): string {
  return translate(lang, key, params);
}

export function getLangCookie(astro: Pick<AstroGlobal, 'cookies'>): Lang | null {
  const raw = astro.cookies.get(LANG_COOKIE_NAME)?.value;
  return isLang(raw) ? raw : null;
}

export function setLangCookie(astro: Pick<AstroGlobal, 'cookies'>, lang: Lang) {
  astro.cookies.set(LANG_COOKIE_NAME, lang, {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax',
  });
}

export function getUniverseLabel(slug: string, lang: Lang): string {
  return UNIVERSE_DICTIONARIES[lang][slug]?.name ?? UNIVERSE_DICTIONARIES.en[slug]?.name ?? slug;
}

export function getCharacterText(character: CharacterInput, lang: Lang) {
  const overlay = CHARACTER_DICTIONARIES[lang][character.slug];
  const fallback = CHARACTER_DICTIONARIES.en[character.slug];
  const name = overlay?.name ?? fallback?.name ?? character.name;
  const description = overlay?.description ?? fallback?.description ?? character.description ?? undefined;
  return { name, description };
}

type I18nContextValue = {
  lang: Lang;
  t: (key: string, params?: TranslateParams) => string;
  getUniverseLabel: (slug: string) => string;
  getCharacterText: (character: CharacterInput) => { name: string; description?: string };
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ lang, children }: { lang?: Lang; children: ReactNode }) {
  const initialLang = lang ?? DEFAULT_LANG;
  const [current, setCurrent] = useState<Lang>(initialLang);

  useEffect(() => {
    if (lang && lang !== current) {
      setCurrent(lang);
    }
  }, [lang, current]);

  useEffect(() => {
    if (!lang && typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (isLang(stored) && stored !== current) {
        setCurrent(stored);
        return;
      }
      const browser = window.navigator?.language || window.navigator?.languages?.[0];
      if (!stored && browser) {
        const detected = browser.toLowerCase().startsWith('fr') ? 'fr' : 'en';
        if (detected !== current) setCurrent(detected);
      }
    }
  }, [lang, current]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LANG_STORAGE_KEY, current);
      } catch (error) {
        console.warn('Failed to persist language preference', error);
      }
    }
  }, [current]);

  const value = useMemo<I18nContextValue>(() => ({
    lang: current,
    t: (key: string, params?: TranslateParams) => translate(current, key, params),
    getUniverseLabel: (slug: string) => getUniverseLabel(slug, current),
    getCharacterText: (character: CharacterInput) => getCharacterText(character, current),
  }), [current]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}

export function useI18nOptional(): I18nContextValue | null {
  return useContext(I18nContext);
}

export function persistLangClient(lang: Lang) {
  if (typeof document !== 'undefined') {
    document.cookie = `${LANG_COOKIE_NAME}=${lang}; Max-Age=31536000; Path=/`;
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch (error) {
      console.warn('Failed to persist language preference', error);
    }
  }
}

export function getCharacterOverlay(lang: Lang) {
  return CHARACTER_DICTIONARIES[lang];
}

export function getUniverseOverlay(lang: Lang) {
  return UNIVERSE_DICTIONARIES[lang];
}

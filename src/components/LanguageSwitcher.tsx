import { useEffect, useState } from 'react';
import type { Lang } from '@/i18n';
import { isLang, persistLangClient, useI18nOptional } from '@/i18n';

const OPTIONS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'fr', label: 'FR' },
];

type Props = {
  lang?: Lang;
};

export default function LanguageSwitcher({ lang }: Props) {
  const ctx = useI18nOptional();
  const initial = lang ?? ctx?.lang ?? 'en';
  const [current, setCurrent] = useState<Lang>(initial);

  useEffect(() => {
    if (lang && lang !== current) {
      setCurrent(lang);
    }
  }, [lang, current]);

  useEffect(() => {
    if (ctx && ctx.lang !== current) {
      setCurrent(ctx.lang);
    }
  }, [ctx, current]);

  const onChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
    const value = event.target.value;
    if (!isLang(value)) return;
    setCurrent(value);
    persistLangClient(value);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', value);
    window.location.href = url.toString();
  };

  return (
    <div className="flex items-center">
      <label htmlFor="language-switcher" className="sr-only">
        Language
      </label>
      <select
        id="language-switcher"
        value={current}
        onChange={onChange}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

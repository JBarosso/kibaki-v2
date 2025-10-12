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
    <div className="language-switcher">
      <label htmlFor="language-switcher" className="language-switcher__label">
        Language
      </label>
      <select
        id="language-switcher"
        value={current}
        onChange={onChange}
        className="language-switcher__select"
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

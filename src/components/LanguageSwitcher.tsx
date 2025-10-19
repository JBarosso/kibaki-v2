import { useEffect, useState } from 'react';
import type { Lang } from '@/i18n';
import { isLang, persistLangClient, useI18nOptional } from '@/i18n';
import CustomSelect from '@/components/CustomSelect';

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

  const onChange = (value: string) => {
    if (!isLang(value)) return;
    setCurrent(value as Lang);
    persistLangClient(value as Lang);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', value);
    window.location.href = url.toString();
  };

  return (
    <div className="language-switcher">
      {/* <label htmlFor="language-switcher" className="language-switcher__label">
        Language
      </label> */}
      <CustomSelect
        options={OPTIONS}
        value={current}
        onChange={onChange}
        className="language-switcher__select"
      />
    </div>
  );
}

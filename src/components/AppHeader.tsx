import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { I18nProvider, type Lang } from '@/i18n';
import { Info } from 'lucide-react';

type NavLabels = {
  duel: string;
  tournaments: string;
  top: string;
  submit: string;
  account: string;
  profile: string;
  info: string;
  legal: string;
  privacy: string;
  terms: string;
};

type ActionLabels = {
  signIn: string;
  signOut: string;
};

type AppHeaderProps = {
  lang: Lang;
  navLabels: NavLabels;
  actionLabels: ActionLabels;
  infoText: string;
};

type Profile = {
  id: string;
  username: string | null;
  is_admin: boolean | null;
};

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

export default function AppHeader(props: AppHeaderProps) {
  return (
    <I18nProvider lang={props.lang}>
      <HeaderInner {...props} />
    </I18nProvider>
  );
}

function HeaderInner({ lang, navLabels, actionLabels, infoText }: AppHeaderProps) {
  const [session, setSession] = useState<Session>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [infoDropdownOpen, setInfoDropdownOpen] = useState(false);
  const infoDropdownRef = useRef<HTMLDivElement>(null);

  // Update CSS variable with header height
  useEffect(() => {
    const updateHeaderHeight = () => {
      const header = document.querySelector('.app-header');
      if (header) {
        const height = header.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--header-height', `${height}px`);
      }
    };

    // Update on mount and resize
    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session) { setProfile(null); return; }
      const uid = session.user.id;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, is_admin')
        .eq('id', uid)
        .maybeSingle();
      if (!error) setProfile((data as Profile) ?? null);
    };
    fetchProfile();
  }, [session]);

  const [currentPath, setCurrentPath] = useState('');
  useEffect(() => {
    setCurrentPath(typeof window !== 'undefined' ? window.location.pathname : '');
  }, []);

  // Close info dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (infoDropdownRef.current && !infoDropdownRef.current.contains(event.target as Node)) {
        setInfoDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (href: string) => currentPath === href || currentPath.startsWith(href + '/');

  const username = profile?.username ?? undefined;
  const isAdmin = profile?.is_admin === true;

  return (
    <header className="app-header">
      <div className="app-header__container">
        <a href="/" className="app-header__logo">Kibaki</a>

        <nav className="app-header__nav">
          <a href="/duel" className={linkCls(isActive('/duel'))}>{navLabels.duel}</a>
          <a href="/t" className={linkCls(isActive('/t'))}>{navLabels.tournaments}</a>
          <a href="/top" className={linkCls(isActive('/top'))}>{navLabels.top}</a>
          <a href="/submit" className={linkCls(isActive('/submit'))}>{navLabels.submit}</a>
          {session ? (
            <>
              <a href="/account" className={linkCls(isActive('/account'))}>{navLabels.account}</a>
              {username && (
                <a href={`/u/${username}`} className={linkCls(isActive(`/u/${username}`))}>{navLabels.profile}</a>
              )}
              {isAdmin && (
                <a href="/admin/submissions" className={linkCls(isActive('/admin/submissions'))}>Admin</a>
              )}
            </>
          ) : (
            <a href="/account" className={linkCls(isActive('/account'))}>{actionLabels.signIn}</a>
          )}

          {/* Info dropdown */}
          <div className="app-header__info-dropdown" ref={infoDropdownRef}>
            <button
              type="button"
              className={`app-header__info-summary ${infoDropdownOpen ? 'app-header__info-summary--open' : ''}`}
              onClick={() => setInfoDropdownOpen(!infoDropdownOpen)}
              aria-haspopup="true"
              aria-expanded={infoDropdownOpen}
            >
              <Info className="app-header__info-icon" aria-hidden="true" size={18} />
            </button>

            {infoDropdownOpen && (
              <div className="app-header__info-content">
                <ul className="app-header__info-list">
                  <li className="app-header__info-item">
                    <a className="app-header__info-link" href="/legal">{navLabels.legal}</a>
                  </li>
                  <li className="app-header__info-item">
                    <a className="app-header__info-link" href="/privacy">{navLabels.privacy}</a>
                  </li>
                  <li className="app-header__info-item">
                    <a className="app-header__info-link" href="/terms">{navLabels.terms}</a>
                  </li>
                </ul>
                <p className="app-header__info-text">{infoText}</p>
              </div>
            )}
          </div>

          <LanguageSwitcher lang={lang} />
        </nav>
      </div>
    </header>
  );
}

function linkCls(active: boolean) {
  return `app-header__link ${active ? 'app-header__link--active' : ''}`;
}

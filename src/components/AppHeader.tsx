import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { I18nProvider, type Lang } from '@/i18n';
import { Info, Menu, X, Swords, Trophy, Home, User } from 'lucide-react';

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
  headerClassName?: string;
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

function HeaderInner({ lang, navLabels, actionLabels, infoText, headerClassName }: AppHeaderProps) {
  const [session, setSession] = useState<Session>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [infoDropdownOpen, setInfoDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const infoDropdownRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (infoDropdownRef.current && !infoDropdownRef.current.contains(event.target as Node)) {
        setInfoDropdownOpen(false);
      }
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        // Don't close if clicking the burger button
        if (!target.closest('.app-header__burger')) {
          setMobileMenuOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const isActive = (href: string) => currentPath === href || currentPath.startsWith(href + '/');

  const username = profile?.username ?? undefined;
  const isAdmin = profile?.is_admin === true;

  // Navigation items configuration with icons
  const navItems = [
    { href: '/duel', label: navLabels.duel, icon: Swords },
    { href: '/t', label: navLabels.tournaments, icon: Home },
    { href: '/top', label: navLabels.top, icon: Trophy },
    { href: '/submit', label: navLabels.submit, icon: null },
  ];

  return (
    <header className={`app-header${headerClassName ? ` ${headerClassName}` : ''}`}>
      <div className="app-header__container">
        <a href="/" className="app-header__logo">Kibaki</a>

        {/* Burger button (mobile only) */}
        <button
          type="button"
          className={`app-header__burger ${mobileMenuOpen ? 'app-header__burger--open' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Backdrop (mobile only) */}
        {mobileMenuOpen && (
          <div
            className="app-header__backdrop"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Single navigation (transforms between desktop/mobile) */}
        <nav
          className={`app-header__nav ${mobileMenuOpen ? 'app-header__nav--open' : ''}`}
          ref={navRef}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <a
                key={item.href}
                href={item.href}
                className={linkCls(active)}
                onClick={() => setMobileMenuOpen(false)}
              >
                {Icon && <Icon className="app-header__link-icon" size={20} />}
                <span className="app-header__link-label">{item.label}</span>
              </a>
            );
          })}
          {session ? (
            <>
              <a
                href="/account"
                className={linkCls(isActive('/account'))}
                onClick={() => setMobileMenuOpen(false)}
              >
                <User className="app-header__link-icon" size={20} />
                <span className="app-header__link-label">{navLabels.account}</span>
              </a>
              {username && (
                <a
                  href={`/u/${username}`}
                  className={linkCls(isActive(`/u/${username}`))}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <User className="app-header__link-icon" size={20} />
                  <span className="app-header__link-label">{navLabels.profile}</span>
                </a>
              )}
              {isAdmin && (
                <a
                  href="/admin/submissions"
                  className={linkCls(isActive('/admin/submissions'))}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="app-header__link-label">Admin</span>
                </a>
              )}
            </>
          ) : (
            <a
              href="/account"
              className={linkCls(isActive('/account'))}
              onClick={() => setMobileMenuOpen(false)}
            >
              <User className="app-header__link-icon" size={20} />
              <span className="app-header__link-label">{actionLabels.signIn}</span>
            </a>
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

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  id: string;
  username: string | null;
  is_admin: boolean | null;
};

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

export default function AppHeader() {
  const [session, setSession] = useState<Session>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

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

  const isActive = (href: string) => currentPath === href;

  const username = profile?.username ?? undefined;
  const isAdmin = profile?.is_admin === true;

  return (
    <header className="border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <a href="/" className="font-semibold tracking-tight">Kibaki</a>

        <nav className="flex items-center gap-4 text-sm">
          <a href="/duel" className={linkCls(isActive('/duel'))}>Duel</a>
          <a href="/top" className={linkCls(isActive('/top'))}>Top</a>
          <a href="/submit" className={linkCls(isActive('/submit'))}>Soumettre</a>
          {session ? (
            <>
              <a href="/account" className={linkCls(isActive('/account'))}>Mon compte</a>
              {username && (
                <a href={`/u/${username}`} className={linkCls(isActive(`/u/${username}`))}>Profil</a>
              )}
              {isAdmin && (
                <a href="/admin/submissions" className={linkCls(isActive('/admin/submissions'))}>Admin</a>
              )}
            </>
          ) : (
            <a href="/account" className={linkCls(isActive('/account'))}>Se connecter</a>
          )}
        </nav>
      </div>
    </header>
  );
}

function linkCls(active: boolean) {
  return [
    'rounded px-2 py-1 hover:bg-gray-100 transition-colors',
    active ? 'text-gray-900 font-medium' : 'text-gray-600'
  ].join(' ');
}



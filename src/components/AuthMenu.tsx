import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  id: string;
  username: string | null;
  is_admin: boolean | null;
};

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

function linkCls(active: boolean) {
  return [
    'rounded px-2 py-1 hover:bg-gray-100 transition-colors',
    active ? 'text-gray-900 font-medium' : 'text-gray-600',
  ].join(' ');
}

function isActivePath(current: string, href: string) {
  if (!current) return false;
  if (current === href) return true;
  return current.startsWith(`${href}/`);
}

export default function AuthMenu() {
  const [session, setSession] = useState<Session>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentPath, setCurrentPath] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          setSession(data?.session ?? null);
        }

        const userId = data?.session?.user?.id;
        if (userId) {
          const { data: prof, error } = await supabase
            .from('profiles')
            .select('id, username, is_admin')
            .eq('id', userId)
            .maybeSingle();
          if (!cancelled) {
            if (error) console.debug('[auth-menu] profiles load:', error.message);
            setProfile((prof as Profile) ?? null);
          }
        } else if (!cancelled) {
          setProfile(null);
        }
      } catch (e) {
        console.debug('[auth-menu] init error (non-blocking):', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const { data } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (cancelled) return;
      setSession(newSession);
      const userId = newSession?.user?.id;
      if (!userId) {
        setProfile(null);
        return;
      }

      try {
        const { data: prof, error } = await supabase
          .from('profiles')
          .select('id, username, is_admin')
          .eq('id', userId)
          .maybeSingle();
        if (!cancelled) {
          if (error) console.debug('[auth-menu] profiles load:', error.message);
          setProfile((prof as Profile) ?? null);
        }
      } catch (e) {
        console.debug('[auth-menu] profile refresh error (non-blocking):', e);
      }
    });

    return () => {
      cancelled = true;
      data?.subscription?.unsubscribe();
    };
  }, []);

  const username = profile?.username ?? undefined;
  const isAdmin = profile?.is_admin === true;

  if (!session) {
    return <a href="/account" className={linkCls(isActivePath(currentPath, '/account'))}>Se connecter</a>;
  }

  return (
    <>
      <a href="/account" className={linkCls(isActivePath(currentPath, '/account'))}>Mon compte</a>
      {username ? (
        <a href={`/u/${username}`} className={linkCls(isActivePath(currentPath, `/u/${username}`))}>Profil</a>
      ) : null}
      {isAdmin ? (
        <a href="/admin/submissions" className={linkCls(isActivePath(currentPath, '/admin/submissions'))}>Admin</a>
      ) : null}
    </>
  );
}

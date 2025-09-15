import { supabase } from '@/lib/supabaseClient';

export async function ensureOwnProfile(username?: string) {
  const { data: userData, error: uerr } = await supabase.auth.getUser();
  if (uerr || !userData.user) throw new Error('Not authenticated');

  const uid = userData.user.id;

  const { data: rows, error: selErr } = await supabase
    .from('profiles')
    .select('id, username, created_at, updated_at')
    .eq('id', uid)
    .maybeSingle();

  if (selErr) throw selErr;
  if (rows) return rows;

  const desired = username ?? `user_${uid.slice(0, 8)}`;

  const { data: inserted, error: insErr } = await supabase
    .from('profiles')
    .insert({ id: uid, username: desired })
    .select('id, username, created_at, updated_at')
    .single();

  if (insErr) throw insErr;
  return inserted;
}

export async function updateUsername(newName: string) {
  const { data: userData, error: uerr } = await supabase.auth.getUser();
  if (uerr || !userData.user) throw new Error('Not authenticated');
  const uid = userData.user.id;

  const { data, error } = await supabase
    .from('profiles')
    .update({ username: newName })
    .eq('id', uid)
    .select('id, username, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

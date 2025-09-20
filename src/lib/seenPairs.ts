import { supabase } from '@/lib/supabaseClient';

export async function getRecentSeenPairs(limit = 500): Promise<Set<string>> {
  const { data: userData, error: uerr } = await supabase.auth.getUser();
  if (uerr || !userData.user) return new Set();
  const { data, error } = await supabase
    .from('user_seen_pairs')
    .select('pair_key')
    .order('seen_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (import.meta.env?.DEV) console.warn('[seenPairs] fetch error', error);
    return new Set();
  }
  return new Set((data ?? []).map(r => r.pair_key as string));
}

export async function markPairSeen(pairKey: string): Promise<void> {
  const { data: userData, error: uerr } = await supabase.auth.getUser();
  if (uerr || !userData.user) return;
  const { error } = await supabase
    .from('user_seen_pairs')
    .upsert(
      [{ user_id: userData.user.id, pair_key: pairKey, seen_at: new Date().toISOString() }],
      { onConflict: 'user_id,pair_key', ignoreDuplicates: false }
    );
  if (error && import.meta.env?.DEV) console.warn('[seenPairs] upsert error', error);
}



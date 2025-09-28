import { supabase } from '@/lib/supabaseClient';

export type Universe = { id: number; slug: string; name: string };

export async function fetchUniverses(limit=200) {
  return supabase
    .from('univers')
    .select('id, slug, name')
    .order('name', { ascending: true })
    .limit(limit);
}

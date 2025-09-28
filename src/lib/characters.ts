import { supabase } from '@/lib/supabaseClient';

export type CharacterLite = { id: number; name: string; slug: string; universe_id: number | null };

export async function searchCharacters(params: { q?: string; universe_id?: number | null; limit?: number; offset?: number }) {
  const { q = '', universe_id = null, limit = 50, offset = 0 } = params ?? {};
  let query = supabase
    .from('characters')
    .select('id, name, slug, universe_id')
    .order('elo', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);
  if (universe_id) query = query.eq('universe_id', universe_id);
  if (q && q.trim()) query = query.ilike('name', `%${q.trim()}%`);
  return query;
}

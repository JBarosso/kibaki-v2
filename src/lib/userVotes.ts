import { supabase } from '@/lib/supabaseClient';

export type LiteCharacter = {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  elo: number;
};

export type UserVote = {
  id: number;
  created_at: string;
  voter_user_id: string | null;
  winner: LiteCharacter;
  loser: LiteCharacter;
};

// Utilities
function toLiteCharacter(row: any): LiteCharacter {
  return {
    id: Number(row?.id),
    name: String(row?.name ?? ''),
    slug: String(row?.slug ?? ''),
    image_url: row?.image_url ?? null,
    elo: Number(row?.elo ?? 0),
  };
}

export async function getUserIdByUsername(username: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to lookup user id: ${error.message}`);
  }
  return (data as { id: string } | null)?.id ?? null;
}

export async function fetchLastVotesByUserId(userId: string, limit = 20): Promise<UserVote[]> {
  if (!userId) return [];

  // Primary path: nested select via PostgREST with FK aliases
  const nestedSelect = `
    id, created_at, voter_user_id,
    winner:characters!votes_winner_id_fkey ( id, name, slug, image_url, elo ),
    loser:characters!votes_loser_id_fkey  ( id, name, slug, image_url, elo )
  `;

  const primary = await supabase
    .from('votes')
    .select(nestedSelect)
    .eq('voter_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!primary.error && Array.isArray(primary.data)) {
    const rows = primary.data as any[];
    return rows
      .filter((r) => r && r.winner && r.loser)
      .map((r) => ({
        id: Number(r.id),
        created_at: String(r.created_at),
        voter_user_id: r.voter_user_id ?? null,
        winner: toLiteCharacter(r.winner),
        loser: toLiteCharacter(r.loser),
      }));
  }

  // Fallback: 2-step mapping if relation/constraint names fail
  const fallback = await supabase
    .from('votes')
    .select('id, created_at, voter_user_id, winner_id, loser_id')
    .eq('voter_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fallback.error) {
    throw new Error(`Failed to fetch votes: ${fallback.error.message}`);
  }

  const voteRows = (fallback.data ?? []) as Array<{
    id: number;
    created_at: string;
    voter_user_id: string | null;
    winner_id: number;
    loser_id: number;
  }>;

  if (voteRows.length === 0) return [];

  const uniqueCharacterIds = Array.from(
    new Set<number>(
      voteRows.flatMap((v) => [Number(v.winner_id), Number(v.loser_id)])
    )
  );

  const { data: chars, error: charsErr } = await supabase
    .from('characters')
    .select('id, name, slug, image_url, elo')
    .in('id', uniqueCharacterIds);

  if (charsErr) {
    throw new Error(`Failed to fetch characters for votes: ${charsErr.message}`);
  }

  const idToCharacter = new Map<number, LiteCharacter>();
  for (const c of (chars ?? [])) {
    idToCharacter.set(Number((c as any).id), toLiteCharacter(c));
  }

  return voteRows
    .map((v) => {
      const w = idToCharacter.get(Number(v.winner_id));
      const l = idToCharacter.get(Number(v.loser_id));
      if (!w || !l) return null;
      const mapped: UserVote = {
        id: Number(v.id),
        created_at: String(v.created_at),
        voter_user_id: v.voter_user_id ?? null,
        winner: w,
        loser: l,
      };
      return mapped;
    })
    .filter((x): x is UserVote => Boolean(x));
}

export async function fetchLastVotesByUsername(username: string, limit = 20): Promise<UserVote[]> {
  if (!username) return [];
  const userId = await getUserIdByUsername(username);
  if (!userId) return [];
  return fetchLastVotesByUserId(userId, limit);
}



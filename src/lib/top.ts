import { supabase } from "@/lib/supabaseClient";

export type Universe = { id: number; slug: string; name: string };

export type TopCharacter = {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  elo: number;
  wins: number;
  losses: number;
  universe: { id: number; slug: string; name: string };
};

export type TopQuery = {
  universeSlug?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

type CharacterQueryRow = {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  elo: number;
  wins: number;
  losses: number;
  universe: Universe | null;
};

const CHARACTER_SELECT = `
  id, name, slug, image_url, elo, wins, losses,
  universe:univers!inner ( id, slug, name )
`;

export async function fetchUniverses(): Promise<Universe[]> {
  const { data, error } = await supabase
    .from("univers")
    .select("id,slug,name")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Universe[];
}

export async function fetchTopCharacters(q: TopQuery = {}): Promise<TopCharacter[]> {
  const limit = q.limit ?? 100;
  const offset = q.offset ?? 0;

  let universeId: number | undefined = undefined;
  if (q.universeSlug) {
    const { data: u, error: ue } = await supabase
      .from('univers')
      .select('id')
      .eq('slug', q.universeSlug)
      .maybeSingle();
    if (ue) throw new Error(ue.message);
    universeId = u?.id;
    if (universeId === undefined) return [];
  }

  let query = supabase
    .from('characters')
    .select(`
        id, name, slug, image_url, elo, wins, losses,
        universe:univers ( id, slug, name )
      `)
    .order('elo', { ascending: false })
    .order('wins', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (universeId !== undefined) query = query.eq('universe_id', universeId);
  if (q.search && q.search.trim()) query = query.ilike('name', `%${q.search.trim()}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapCharacterRow(row as unknown as CharacterQueryRow));
}

function mapCharacterRow(row: CharacterQueryRow): TopCharacter {
  if (!row.universe) {
    // Should not happen due to inner join, but guard for safety
    throw new Error("Missing related universe for character row");
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    image_url: row.image_url,
    elo: row.elo,
    wins: row.wins,
    losses: row.losses,
    universe: {
      id: row.universe.id,
      slug: row.universe.slug,
      name: row.universe.name,
    },
  };
}


export async function fetchRankMap(opts?: { universeSlug?: string; max?: number }): Promise<Map<number, number>> {
  const max = opts?.max ?? 2000;
  let universeId: number | undefined = undefined;

  if (opts?.universeSlug) {
    const { data: u, error: ue } = await supabase
      .from('univers')
      .select('id')
      .eq('slug', opts.universeSlug)
      .maybeSingle();
    if (ue) throw new Error(ue.message);
    if (!u?.id) return new Map();
    universeId = u.id;
  }

  let q = supabase
    .from('characters')
    .select('id, elo, wins')
    .order('elo', { ascending: false })
    .order('wins', { ascending: false })
    .order('id', { ascending: true })
    .limit(max);

  if (universeId !== undefined) q = q.eq('universe_id', universeId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const m = new Map<number, number>();
  (data ?? []).forEach((row: any, idx: number) => m.set(row.id as number, idx + 1));
  return m;
}



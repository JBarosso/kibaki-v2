import { supabase } from '@/lib/supabaseClient';

export type Tournament = {
  id: string;
  name: string;
  status: 'draft'|'scheduled'|'running'|'completed'|'canceled';
  universe_id: number | null;
  round_duration_minutes: number;
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
};

export type TMatch = {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  char1_id: number | null;
  char2_id: number | null;
  opens_at: string;
  closes_at: string;
  status: 'scheduled'|'open'|'closed'|'void';
  winner_id: number | null;
  char1_votes: number;
  char2_votes: number;
};

export async function listTournaments(limit = 20, offset = 0) {
  return supabase
    .from('tournaments')
    .select('id, name, status, round_duration_minutes, started_at, completed_at, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
}

export async function getTournament(id: string) {
  return supabase
    .from('tournaments')
    .select('id, name, status, round_duration_minutes, started_at, completed_at, universe_id, created_by, created_at')
    .eq('id', id)
    .maybeSingle();
}

export async function getMatches(id: string) {
  return supabase
    .from('tournament_matches')
    .select('id, tournament_id, round, match_number, char1_id, char2_id, opens_at, closes_at, status, winner_id, char1_votes, char2_votes')
    .eq('tournament_id', id)
    .order('round', { ascending: true })
    .order('match_number', { ascending: true });
}

export async function fetchCharacterNames(ids: number[]) {
  if (!ids.length) return { data: [], error: null };
  return supabase
    .from('characters')
    .select('id, name')
    .in('id', ids);
}

export async function voteMatch(matchId: string, choiceId: number) {
  return supabase
    .from('tournament_votes')
    .insert({ match_id: matchId, choice_id: choiceId })
    .select('id')
    .single();
}

export async function tickTournament(id: string) {
  return supabase.rpc('tournament_tick', { p_tournament_id: id });
}

export async function createTournament(params: {
  name: string;
  universe_id?: number | null;
  round_minutes: number;
  start_at?: string | null;
  participants: number[]; // character ids in seed order
}) {
  const { name, universe_id = null, round_minutes, start_at = null, participants } = params;
  return supabase.rpc('tournament_create', {
    p_name: name,
    p_universe_id: universe_id,
    p_participants: participants,
    p_round_minutes: round_minutes,
    p_start: start_at ?? new Date().toISOString(),
  });
}

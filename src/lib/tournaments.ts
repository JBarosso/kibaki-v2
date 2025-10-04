import { supabase } from './supabaseClient'

export type Tournament = {
  id: string
  name: string
  universe_id: number | null
  round_duration_minutes: number
  status: 'scheduled' | 'running' | 'completed' | 'canceled'
  created_by: string
  started_at: string
  completed_at: string | null
}

export type Match = {
  id: string
  tournament_id: string
  round: number
  match_number: number
  char1_id: number | null
  char2_id: number | null
  opens_at: string
  closes_at: string
  status: 'scheduled' | 'open' | 'closed' | 'void'
  winner_id: number | null
  char1_votes: number
  char2_votes: number
}

export async function listTournaments() {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('started_at', { ascending: false })
  if (error) throw error
  return data as Tournament[]
}

export async function getTournament(id: string) {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Tournament
}

export async function getMatches(tournamentId: string) {
  const { data, error } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })
    .order('match_number', { ascending: true })
  if (error) throw error
  return data as Match[]
}

export async function fetchCharacterNames(ids: number[]) {
  if (ids.length === 0) return {}
  const { data, error } = await supabase
    .from('characters')
    .select('id, name')
    .in('id', ids)
  if (error) throw error
  return Object.fromEntries((data ?? []).map((r: any) => [r.id, r.name]))
}

export async function voteMatch(matchId: string, choiceId: number) {
  const { data: userRes } = await supabase.auth.getUser()
  const voter_user_id = userRes?.user?.id ?? null
  const { error } = await supabase.from('tournament_votes').insert({
    match_id: matchId,
    voter_user_id,
    choice_id: choiceId,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  })
  if (error) throw error
}

export async function tickTournament(tournamentId: string) {
  const { error } = await supabase.rpc('tournament_tick', { p_tournament_id: tournamentId })
  if (error) throw error
}

export async function createTournament(params: {
  name: string
  universe_id?: number | null
  participants: number[] // ordered
  round_minutes: number
  start_iso: string
}) {
  const { data, error } = await supabase.rpc('tournament_create', {
    p_name: params.name,
    p_universe_id: params.universe_id ?? null,
    p_participants: params.participants,
    p_round_minutes: params.round_minutes,
    p_start: params.start_iso,
  })
  if (error) throw error
  return data as string
}

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin')
  if (error) return false
  return !!data
}

export async function finishNowTournament(tournamentId: string) {
  const { error } = await supabase.rpc('tournament_finish_now', { p_tournament_id: tournamentId })
  if (error) throw error
}

export async function cancelTournament(tournamentId: string) {
  const { error } = await supabase.rpc('tournament_cancel', { p_tournament_id: tournamentId })
  if (error) throw error
}

export async function deleteTournament(tournamentId: string) {
  const { error } = await supabase.rpc('tournament_delete', { p_tournament_id: tournamentId })
  if (error) throw error
}

export async function purgeOldTournaments(days = 365) {
  const { data, error } = await supabase.rpc('tournament_purge_older_than', { p_days: days })
  if (error) throw error
  return data as number
}

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTournament, getMatches, fetchCharacterNames, tickTournament } from '@/lib/tournaments';
import type { TMatch, Tournament } from '@/lib/tournaments';
import { showToast } from '@/lib/toast';
import ToastProvider from './ToastProvider';

type Profile = { id: string; username: string; is_admin: boolean | null };

interface TournamentBracketClientProps {
  tournamentId: string;
}

export default function TournamentBracketClient({ tournamentId }: TournamentBracketClientProps) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<TMatch[]>([]);
  const [nameById, setNameById] = useState<(id: number | null) => string>(() => (id: number | null) => id?.toString() ?? '—');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [votingStates, setVotingStates] = useState<Record<string, boolean>>({});
  const [voteSuccess, setVoteSuccess] = useState<Record<string, boolean>>({});
  const [tickLoading, setTickLoading] = useState(false);

  // Fetch tournament data client-side
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get tournament
        const { data: t } = await getTournament(tournamentId);
        if (!t) {
          showToast({ type: 'error', message: 'Tournoi introuvable' });
          return;
        }
        setTournament(t);

        // Get matches
        const { data: matchesData = [] } = await getMatches(tournamentId);
        setMatches(matchesData || []);

        // Get character names
        const safeMatchesData = matchesData || [];
        const uniqueIds = Array.from(new Set(
          safeMatchesData.flatMap(m => [m.char1_id, m.char2_id, m.winner_id].filter(Boolean) as number[])
        ));
        
        if (uniqueIds.length > 0) {
          const { data: chars = [] } = await fetchCharacterNames(uniqueIds);
          const nameByIdMap = new Map<number, string>();
          const safeChars = chars || [];
          safeChars.forEach(c => nameByIdMap.set(c.id, c.name));
          setNameById(() => (cid: number | null) => (cid ? (nameByIdMap.get(cid) ?? `#${cid}`) : '—'));
        }

        // Get user profile for admin check
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, username, is_admin')
            .eq('id', userData.user.id)
            .maybeSingle();
          setProfile(profileData);
        }
      } catch (error: any) {
        showToast({ type: 'error', message: `Erreur: ${error.message}` });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tournamentId]);

  const handleVote = async (match: TMatch, choiceId: number) => {
    if (votingStates[match.id]) return; // Already voting

    setVotingStates(prev => ({ ...prev, [match.id]: true }));

    try {
      // Use the Edge Function for voting
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
      const url = `${import.meta.env.PUBLIC_SUPABASE_URL}/functions/v1/vote`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          winner_id: choiceId,
          loser_id: match.char1_id === choiceId ? match.char2_id : match.char1_id,
          nonce: `tournament_${match.id}_${Date.now()}`,
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        if (result.reason === 'rate_limited') {
          showToast({ type: 'error', message: 'Trop de votes, attendez un peu' });
        } else {
          showToast({ type: 'error', message: result.error || 'Erreur de vote' });
        }
        return;
      }

      // Show success state
      setVoteSuccess(prev => ({ ...prev, [match.id]: true }));
      showToast({ type: 'success', message: 'Vote pris en compte ✅' });

      // Hide success state after 1s
      setTimeout(() => {
        setVoteSuccess(prev => ({ ...prev, [match.id]: false }));
      }, 1000);

      // Refresh matches to get updated vote counts
      const { data: updatedMatches = [] } = await getMatches(tournamentId);
      setMatches(updatedMatches || []);

    } catch (error: any) {
      showToast({ type: 'error', message: `Erreur: ${error.message}` });
    } finally {
      setVotingStates(prev => ({ ...prev, [match.id]: false }));
    }
  };

  const handleTick = async () => {
    if (tickLoading) return;
    
    setTickLoading(true);
    try {
      const { error } = await tickTournament(tournamentId);
    if (error) {
        showToast({ type: 'error', message: `Erreur tick: ${error.message}` });
      } else {
        showToast({ type: 'success', message: 'Tournoi mis à jour' });
        // Refresh data
        const { data: updatedMatches = [] } = await getMatches(tournamentId);
        setMatches(updatedMatches || []);
        const { data: updatedTournament } = await getTournament(tournamentId);
        if (updatedTournament) setTournament(updatedTournament);
      }
    } catch (error: any) {
      showToast({ type: 'error', message: `Erreur: ${error.message}` });
    } finally {
      setTickLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Chargement du tournoi...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-8 text-red-600">
        Tournoi introuvable
      </div>
    );
  }

  return (
    <>
      <ToastProvider />
      <div>
        {/* Tournament Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            <div className="text-sm text-gray-500 mt-1">
              {tournament.status} • {tournament.round_duration_minutes} min par round
            </div>
          </div>
          {profile?.is_admin && (
            <button
              onClick={handleTick}
              disabled={tickLoading}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 px-4 py-2 text-white text-sm font-medium transition-colors"
            >
              {tickLoading ? 'Mise à jour...' : 'Mettre à jour'}
            </button>
          )}
        </div>

        {/* Tournament Bracket */}
        <TournamentBracket 
          matches={matches} 
          onVote={handleVote} 
          characterNameById={nameById}
          votingStates={votingStates}
          voteSuccess={voteSuccess}
        />
      </div>
    </>
  );
}

// Updated TournamentBracket component
function TournamentBracket({ 
  matches, 
  onVote, 
  characterNameById,
  votingStates = {},
  voteSuccess = {}
}: {
  matches: TMatch[];
  onVote?: (m: TMatch, choiceId: number) => void;
  characterNameById?: (id: number | null) => string;
  votingStates?: Record<string, boolean>;
  voteSuccess?: Record<string, boolean>;
}) {
  const now = Date.now();
  
  // Group matches by round
  const rounds = new Map<number, TMatch[]>();
  for (const m of matches) {
    if (!rounds.has(m.round)) rounds.set(m.round, []);
    rounds.get(m.round)!.push(m);
  }
  const sortedRounds = Array.from(rounds.keys()).sort((a, b) => a - b);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-6 min-w-max pb-4">
        {sortedRounds.map((roundNum) => {
          const roundMatches = rounds.get(roundNum)!.sort((a, b) => a.match_number - b.match_number);
          
          return (
            <div key={roundNum} className="flex flex-col gap-4 min-w-[280px]">
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-200 text-center">
                Round {roundNum}
              </div>
              
              {roundMatches.map(match => {
                const open = new Date(match.opens_at).getTime() <= now;
                const closed = new Date(match.closes_at).getTime() <= now || match.status === 'closed';
                const char1Name = characterNameById?.(match.char1_id) ?? (match.char1_id?.toString() ?? '—');
                const char2Name = characterNameById?.(match.char2_id) ?? (match.char2_id?.toString() ?? '—');
                const canVote = Boolean(onVote && open && !closed && match.char1_id && match.char2_id);
                const isVoting = votingStates[match.id] || false;
                const showSuccess = voteSuccess[match.id] || false;
                
                return (
                  <div key={match.id} className="rounded-2xl shadow-lg p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    {/* Match info */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Match #{match.match_number}
                    </div>
                    
                    {/* Participants */}
                    <div className="space-y-3">
                      <div className={`flex items-center justify-between p-3 rounded-lg ${
                        match.winner_id === match.char1_id 
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                          : 'bg-gray-50 dark:bg-gray-700'
                      }`}>
                        <div className="flex-1">
                          <div className={`font-medium ${
                            match.winner_id === match.char1_id ? 'text-green-800 dark:text-green-200' : 'text-gray-900 dark:text-gray-100'
                          }`}>
                            {char1Name}
                          </div>
                          {match.char1_votes > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {match.char1_votes} votes
                            </div>
                          )}
                        </div>
                        {canVote && (
                          <button
                            onClick={() => onVote!(match, match.char1_id!)}
                            disabled={isVoting}
                            className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 px-3 py-1.5 text-white text-sm font-medium transition-colors"
                          >
                            {isVoting ? '...' : 'Voter'}
                          </button>
                        )}
                      </div>
                      
                      <div className="text-center text-gray-400 dark:text-gray-500 text-sm font-medium">
                        VS
                      </div>
                      
                      <div className={`flex items-center justify-between p-3 rounded-lg ${
                        match.winner_id === match.char2_id 
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                          : 'bg-gray-50 dark:bg-gray-700'
                      }`}>
                        <div className="flex-1">
                          <div className={`font-medium ${
                            match.winner_id === match.char2_id ? 'text-green-800 dark:text-green-200' : 'text-gray-900 dark:text-gray-100'
                          }`}>
                            {char2Name}
                          </div>
                          {match.char2_votes > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {match.char2_votes} votes
                            </div>
                          )}
                        </div>
                        {canVote && (
                          <button
                            onClick={() => onVote!(match, match.char2_id!)}
                            disabled={isVoting}
                            className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 px-3 py-1.5 text-white text-sm font-medium transition-colors"
                          >
                            {isVoting ? '...' : 'Voter'}
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Status */}
                    <div className="mt-3 text-center">
                      {showSuccess ? (
                        <div className="text-green-600 dark:text-green-400 text-sm font-medium">
                          Vote pris en compte ✅
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {closed 
                            ? (match.winner_id ? `Gagnant: ${characterNameById?.(match.winner_id) ?? match.winner_id}` : 'Terminé') 
                            : (open ? 'Vote ouvert' : 'Programmé')
                          }
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

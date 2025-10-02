import { useEffect, useState } from 'react'
import TournamentBracket from './TournamentBracket'
import { fetchCharacterNames, getMatches, isAdmin, tickTournament, voteMatch, type Match } from '../lib/tournaments'

const LS_KEY = (tid: string) => `kbk_t_votes_${tid}`

type VotesMap = Record<string, number>   // matchId -> choiceId
type FlashMap = Record<string, string>   // matchId -> message

export default function TournamentBracketClient(props: { tournamentId: string }) {
  const [matches, setMatches] = useState<Match[]>([])
  const [nameById, setNameById] = useState<Record<number, string>>({})
  const [nowIso, setNowIso] = useState(new Date().toISOString())
  const [admin, setAdmin] = useState(false)
  const [myVotes, setMyVotes] = useState<VotesMap>({})
  const [flash, setFlash] = useState<FlashMap>({})

  // Load myVotes from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY(props.tournamentId))
      if (raw) setMyVotes(JSON.parse(raw))
    } catch {}
  }, [props.tournamentId])

  const saveVotes = (v: VotesMap) => {
    setMyVotes(v)
    try { localStorage.setItem(LS_KEY(props.tournamentId), JSON.stringify(v)) } catch {}
  }

  async function refresh() {
    const ms = await getMatches(props.tournamentId)
    setMatches(ms)
    setNowIso(new Date().toISOString())

    // Build character id set from fresh matches
    const ids = new Set<number>()
    for (const m of ms) {
      if (m.char1_id) ids.add(m.char1_id)
      if (m.char2_id) ids.add(m.char2_id)
      if (m.winner_id) ids.add(m.winner_id)
    }
    const names = await fetchCharacterNames(Array.from(ids))
    setNameById(names)
  }

  useEffect(() => {
    isAdmin().then(setAdmin)
    // Opportunistic tick (idempotent) then data fetch
    tickTournament(props.tournamentId).catch(()=>{})
    refresh()
    const iv = setInterval(async () => {
      await tickTournament(props.tournamentId).catch(()=>{})
      await refresh()
    }, 60_000)
    return () => clearInterval(iv)
  }, [props.tournamentId])

  const onVote = async (matchId: string, choiceId: number) => {
    if (myVotes[matchId]) return // already voted (client-side restriction)
    await voteMatch(matchId, choiceId)
    const next = { ...myVotes, [matchId]: choiceId }
    saveVotes(next)
    setFlash(prev => ({ ...prev, [matchId]: 'Vote recorded ✅' }))
    await refresh()
    setTimeout(() => setFlash(prev => {
      const { [matchId]: _, ...rest } = prev
      return rest
    }), 3000)
  }

  const onTick = async () => {
    await tickTournament(props.tournamentId)
    await refresh()
  }

  return (
    <div className="space-y-4">
      <TournamentBracket
        matches={matches}
        nameById={nameById}
        nowIso={nowIso}
        onVote={onVote}
        isAdmin={admin}
        onTick={onTick}
        myVotes={myVotes}
        flash={flash}
      />
    </div>
  )
}
import { useEffect, useState } from 'react'
import TournamentBracket from './TournamentBracket'
import {
  fetchCharacterNames, getMatches, isAdmin, tickTournament, voteMatch, type Match,
  finishNowTournament, cancelTournament, deleteTournament
} from '../lib/tournaments'

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
  const [busy, setBusy] = useState(false)

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

  async function doFinishNow() {
    if (!confirm('Finish all rounds now?')) return
    setBusy(true)
    try { await finishNowTournament(props.tournamentId); await refresh() } finally { setBusy(false) }
  }
  async function doCancel() {
    if (!confirm('Cancel this tournament?')) return
    setBusy(true)
    try { await cancelTournament(props.tournamentId); await refresh() } finally { setBusy(false) }
  }
  async function doDelete() {
    if (!confirm('Delete this tournament and ALL its data? This cannot be undone.')) return
    setBusy(true)
    try { await deleteTournament(props.tournamentId); window.location.href = '/t' } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {admin && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={doFinishNow} disabled={busy} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50">
            Finish now
          </button>
          <button onClick={doCancel} disabled={busy} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={doDelete} disabled={busy} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50">
            Delete
          </button>
        </div>
      )}

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
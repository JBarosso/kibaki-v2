import { useEffect, useMemo, useState } from 'react'
import TournamentBracket from './TournamentBracket'
import {
  fetchCharacterNames,
  getMatches,
  isAdmin,
  tickTournament,
  voteMatch,
  type Match,
  finishNowTournament,
  cancelTournament,
  deleteTournament,
} from '../lib/tournaments'
import { I18nProvider, useI18n, type Lang } from '@/i18n'

type CharacterInfo = { slug: string; name: string; description: string | null }

type RoundWindow = { round: number; opensAt: number; closesAt: number }
type Phase =
  | { type: 'completed' }
  | { type: 'starts'; round: number; total: number; deadlineMs: number }
  | { type: 'ends';   round: number; total: number; deadlineMs: number }

const LS_KEY = (tid: string) => `kbk_t_votes_${tid}`

type VotesMap = Record<string, number>   // matchId -> choiceId
type FlashMap = Record<string, string>   // matchId -> message

function formatDuration(ms: number): string {
  if (ms <= 0) return '00:00'
  const sec = Math.floor(ms / 1000)
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function buildRoundWindows(matches: Match[]): RoundWindow[] {
  const byRound = new Map<number, { opensAt: number; closesAt: number }>()
  for (const m of matches) {
    const r = m.round
    const o = new Date(m.opens_at).getTime()
    const c = new Date(m.closes_at).getTime()
    if (!byRound.has(r)) byRound.set(r, { opensAt: o, closesAt: c })
    const cur = byRound.get(r)!
    byRound.set(r, { opensAt: Math.min(cur.opensAt, o), closesAt: Math.max(cur.closesAt, c) })
  }
  return Array.from(byRound.entries())
    .map(([round, v]) => ({ round, ...v }))
    .sort((a, b) => a.round - b.round)
}

function computePhase(rounds: RoundWindow[], nowMs: number): Phase {
  if (rounds.length === 0) return { type: 'completed' }
  const total = rounds.length
  const current = rounds.find(r => nowMs >= r.opensAt && nowMs < r.closesAt)
  if (current) {
    return { type: 'ends', round: current.round, total, deadlineMs: current.closesAt }
  }
  const next = rounds.find(r => nowMs < r.opensAt)
  if (next) {
    return { type: 'starts', round: next.round, total, deadlineMs: next.opensAt }
  }
  return { type: 'completed' }
}

type Props = { tournamentId: string; lang: Lang }

export default function TournamentBracketClient(props: Props) {
  return (
    <I18nProvider lang={props.lang}>
      <TournamentBracketClientInner {...props} />
    </I18nProvider>
  )
}

function TournamentBracketClientInner({ tournamentId }: Props) {
  const { t } = useI18n()
  const [matches, setMatches] = useState<Match[]>([])
  const [nameById, setNameById] = useState<Record<number, CharacterInfo>>({})
  const [nowIso, setNowIso] = useState(new Date().toISOString())
  const [admin, setAdmin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [myVotes, setMyVotes] = useState<VotesMap>({})
  const [flash, setFlash] = useState<FlashMap>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY(tournamentId))
      if (raw) setMyVotes(JSON.parse(raw))
    } catch {}
  }, [tournamentId])

  const saveVotes = (v: VotesMap) => {
    setMyVotes(v)
    try { localStorage.setItem(LS_KEY(tournamentId), JSON.stringify(v)) } catch {}
  }

  async function refresh() {
    const ms = await getMatches(tournamentId)
    setMatches(ms)
    setNowIso(new Date().toISOString())

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
    tickTournament(tournamentId).catch(()=>{})
    refresh()

    const ivTick = setInterval(async () => {
      await tickTournament(tournamentId).catch(()=>{})
      await refresh()
    }, 60_000)

    const ivNow = setInterval(() => {
      setNowIso(new Date().toISOString())
    }, 1_000)

    return () => {
      clearInterval(ivTick)
      clearInterval(ivNow)
    }
  }, [tournamentId])

  const onVote = async (matchId: string, choiceId: number) => {
    if (myVotes[matchId]) return
    await voteMatch(matchId, choiceId)
    const next = { ...myVotes, [matchId]: choiceId }
    saveVotes(next)
    setFlash(prev => ({ ...prev, [matchId]: t('actions.voteTaken') }))
    await refresh()
    setTimeout(() => setFlash(prev => {
      const { [matchId]: _, ...rest } = prev
      return rest
    }), 3000)
  }

  async function doFinishNow() {
    if (typeof finishNowTournament !== 'function') return
    if (!confirm(t('tournaments.confirmFinish'))) return
    setBusy(true)
    try { await finishNowTournament(tournamentId); await refresh() } finally { setBusy(false) }
  }
  async function doCancel() {
    if (typeof cancelTournament !== 'function') return
    if (!confirm(t('tournaments.confirmCancel'))) return
    setBusy(true)
    try { await cancelTournament(tournamentId); await refresh() } finally { setBusy(false) }
  }
  async function doDelete() {
    if (typeof deleteTournament !== 'function') return
    if (!confirm(t('tournaments.confirmDelete'))) return
    setBusy(true)
    try { await deleteTournament(tournamentId); window.location.href = '/t' } finally { setBusy(false) }
  }

  const nowMs = useMemo(() => new Date(nowIso).getTime(), [nowIso])
  const roundWindows = useMemo(() => buildRoundWindows(matches), [matches])
  const phase: Phase = useMemo(() => computePhase(roundWindows, nowMs), [roundWindows, nowMs])

  let bannerText: string | null = null
  if (phase.type === 'starts') {
    const rest = phase.deadlineMs - nowMs
    const duration = formatDuration(rest)
    bannerText = phase.round === 1
      ? t('tournaments.startsIn', { duration })
      : t('tournaments.roundStartsIn', { round: phase.round, total: phase.total, duration })
  } else if (phase.type === 'ends') {
    const rest = phase.deadlineMs - nowMs
    bannerText = t('tournaments.roundEndsIn', { round: phase.round, total: phase.total, duration: formatDuration(rest) })
  } else if (phase.type === 'completed') {
    bannerText = t('tournaments.completed')
  }

  return (
    <div className="space-y-4">
      {admin && (typeof finishNowTournament === 'function') && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={doFinishNow} disabled={busy} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50">
            {t('tournaments.finishNow')}
          </button>
          <button onClick={doCancel} disabled={busy} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50">
            {t('tournaments.cancel')}
          </button>
          <button onClick={doDelete} disabled={busy} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50">
            {t('tournaments.delete')}
          </button>
        </div>
      )}

      {bannerText && (
        <div className="rounded border bg-gray-50 px-3 py-2 text-sm text-gray-800" aria-live="polite">
          {bannerText}
        </div>
      )}

      <TournamentBracket
        matches={matches}
        nameById={nameById}
        nowIso={nowIso}
        onVote={onVote}
        isAdmin={admin}
        onTick={async () => { await tickTournament(tournamentId); await refresh() }}
        myVotes={myVotes}
        flash={flash}
      />
    </div>
  )
}

export type { CharacterInfo }

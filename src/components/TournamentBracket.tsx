import type { Match } from '../lib/tournaments'

export function groupByRound(matches: Match[]) {
  const map = new Map<number, Match[]>()
  matches.forEach(m => {
    const arr = map.get(m.round) ?? []
    arr.push(m)
    map.set(m.round, arr)
  })
  return Array.from(map.entries()).sort((a,b)=>a[0]-b[0])
}

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

export default function TournamentBracket(props: {
  matches: Match[]
  nameById: Record<number, string>
  nowIso: string
  onVote?: (matchId: string, choiceId: number)=>void
  isAdmin?: boolean
  onTick?: ()=>void
  myVotes?: Record<string, number>
  flash?: Record<string, string>
}) {
  const now = new Date(props.nowIso).getTime()
  const rounds = groupByRound(props.matches)
  const myVotes = props.myVotes ?? {}
  const flash = props.flash ?? {}

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {rounds.map(([round, ms]) => (
        <div key={round} className="rounded-2xl border p-3">
          <div className="mb-2 text-sm font-semibold">Round {round}</div>
          <div className="space-y-3">
            {ms.map(m => {
              const opens = new Date(m.opens_at).getTime()
              const closes = new Date(m.closes_at).getTime()
              const before = now < opens
              const during = now >= opens && now < closes
              const c1 = m.char1_id ? props.nameById[m.char1_id] ?? `#${m.char1_id}` : '— bye —'
              const c2 = m.char2_id ? props.nameById[m.char2_id] ?? `#${m.char2_id}` : '— bye —'
              const userChoice = myVotes[m.id]
              const userChoseC1 = !!userChoice && m.char1_id === userChoice
              const userChoseC2 = !!userChoice && m.char2_id === userChoice
              const canVote = during && !!m.char1_id && !!m.char2_id && props.onVote && !userChoice && m.status === 'open'

              const countdown =
                before ? `Starts in ${formatDuration(opens - now)}`
                : during ? `Ends in ${formatDuration(closes - now)}`
                : null

              return (
                <div key={m.id} className="rounded border p-3">
                  <div className="text-xs text-gray-500 mb-1">
                    {new Date(m.opens_at).toLocaleString()} → {new Date(m.closes_at).toLocaleString()}
                  </div>

                  {/* Per-match countdown */}
                  {countdown && (
                    <div className="mb-2 text-xs text-gray-700" aria-live="polite">⏳ {countdown}</div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate ${userChoseC1 ? 'font-semibold' : ''}`}>{c1}</span>
                      {canVote ? (
                        <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                                onClick={()=>props.onVote!(m.id, m.char1_id!)}>Vote</button>
                      ) : (
                        <span className="text-xs text-gray-500">{m.char1_votes}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate ${userChoseC2 ? 'font-semibold' : ''}`}>{c2}</span>
                      {canVote ? (
                        <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                                onClick={()=>props.onVote!(m.id, m.char2_id!)}>Vote</button>
                      ) : (
                        <span className="text-xs text-gray-500">{m.char2_votes}</span>
                      )}
                    </div>

                    {userChoice && (
                      <div className="text-xs text-green-700">
                        You voted: {userChoseC1 ? c1 : userChoseC2 ? c2 : `#${userChoice}`}
                      </div>
                    )}

                    {flash[m.id] && (
                      <div className="text-xs text-green-700">{flash[m.id]}</div>
                    )}

                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-xs ${m.status === 'closed' ? 'text-green-700' : 'text-gray-600'}`}>
                        {m.status.toUpperCase()}
                      </span>
                      {m.winner_id && (
                        <span className="text-xs font-medium">
                          Winner: {props.nameById[m.winner_id] ?? `#${m.winner_id}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {props.isAdmin && props.onTick && round === rounds[rounds.length-1][0] && (
            <div className="pt-2">
              <button onClick={props.onTick} className="rounded-md bg-black px-4 py-2 text-white hover:opacity-90">
                Update (tick)
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
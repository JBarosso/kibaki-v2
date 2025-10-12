import type { Match } from '../lib/tournaments'
import type { CharacterInfo } from './TournamentBracketClient'
import { useI18n } from '@/i18n'

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
  const d = Math.floor(ms / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

type CharacterNameMap = Record<number, CharacterInfo>

type Props = {
  matches: Match[]
  nameById: CharacterNameMap
  nowIso: string
  onVote?: (matchId: string, choiceId: number)=>void
  isAdmin?: boolean
  onTick?: ()=>void
  myVotes?: Record<string, number>
  flash?: Record<string, string>
}

export default function TournamentBracket(props: Props) {
  const { getCharacterText, t } = useI18n()
  const now = new Date(props.nowIso).getTime()
  const rounds = groupByRound(props.matches)
  const myVotes = props.myVotes ?? {}
  const flash = props.flash ?? {}

  const resolveCharacter = (id?: number | null) => {
    if (!id) return { name: '—', description: undefined }
    const info = props.nameById[id]
    if (!info) return { name: `#${id}`, description: undefined }
    return getCharacterText({ slug: info.slug, name: info.name, description: info.description })
  }

  return (
    <div className="tournament-bracket">
      {rounds.map(([round, ms]) => (
        <div key={round} className="tournament-bracket__round">
          <div className="tournament-bracket__round-title">{t('tournaments.roundLabel', { round })}</div>
          <div className="tournament-bracket__matches">
            {ms.map(m => {
              const opens = new Date(m.opens_at).getTime()
              const closes = new Date(m.closes_at).getTime()
              const before = now < opens
              const during = now >= opens && now < closes
              const c1 = resolveCharacter(m.char1_id)
              const c2 = resolveCharacter(m.char2_id)
              const winner = resolveCharacter(m.winner_id ?? undefined)
              const userChoice = myVotes[m.id]
              const userChoseC1 = !!userChoice && m.char1_id === userChoice
              const userChoseC2 = !!userChoice && m.char2_id === userChoice
              const canVote = during && !!m.char1_id && !!m.char2_id && props.onVote && !userChoice && m.status === 'open'

              const countdown = before
                ? t('tournaments.statusOpens', { duration: formatDuration(opens - now) })
                : during
                  ? t('tournaments.statusEnds', { duration: formatDuration(closes - now) })
                  : null

              return (
                <div key={m.id} className="tournament-bracket__match">
                  <div className="tournament-bracket__match-time">
                    {new Date(m.opens_at).toLocaleString()} → {new Date(m.closes_at).toLocaleString()}
                  </div>

                  {countdown && (
                    <div className="tournament-bracket__countdown" aria-live="polite">⏳ {countdown}</div>
                  )}

                  <div className="tournament-bracket__competitors">
                    <div className="tournament-bracket__competitor">
                      <span className={`tournament-bracket__competitor-name ${userChoseC1 ? 'tournament-bracket__competitor-name--selected' : ''}`}>{c1.name}</span>
                      {canVote ? (
                        <button className="tournament-bracket__vote-button"
                                onClick={()=>props.onVote!(m.id, m.char1_id!)}>{t('tournaments.vote')}</button>
                      ) : (
                        <span className="tournament-bracket__votes">{m.char1_votes}</span>
                      )}
                    </div>
                    <div className="tournament-bracket__competitor">
                      <span className={`tournament-bracket__competitor-name ${userChoseC2 ? 'tournament-bracket__competitor-name--selected' : ''}`}>{c2.name}</span>
                      {canVote ? (
                        <button className="tournament-bracket__vote-button"
                                onClick={()=>props.onVote!(m.id, m.char2_id!)}>{t('tournaments.vote')}</button>
                      ) : (
                        <span className="tournament-bracket__votes">{m.char2_votes}</span>
                      )}
                    </div>

                    {userChoice && (
                      <div className="tournament-bracket__user-vote">
                        {t('tournaments.youVoted', { name: userChoseC1 ? c1.name : userChoseC2 ? c2.name : `#${userChoice}` })}
                      </div>
                    )}

                    {flash[m.id] && (
                      <div className="tournament-bracket__flash">{flash[m.id]}</div>
                    )}

                    <div className="tournament-bracket__footer">
                      <span className={`tournament-bracket__status ${m.status === 'closed' ? 'tournament-bracket__status--closed' : ''}`}>
                        {m.status.toUpperCase()}
                      </span>
                      {m.winner_id && (
                        <span className="tournament-bracket__winner">
                          {t('tournaments.winner', { name: winner.name })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {props.isAdmin && props.onTick && round === rounds[rounds.length-1][0] && (
            <div className="tournament-bracket__admin">
              <button onClick={props.onTick} className="tournament-bracket__update-button">
                {t('tournaments.update')}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

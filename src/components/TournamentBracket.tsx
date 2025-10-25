import type { Match } from '../lib/tournaments'
import type { CharacterInfo } from './TournamentBracketClient'
import { useI18n } from '@/i18n'
import { Timer, ChevronDown } from 'lucide-react'
import { useState, useMemo } from 'react'

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
  const d = Math.floor(sec / 86400)  // Utiliser sec (secondes) au lieu de ms
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

type RoundStatus = 'upcoming' | 'in_progress' | 'completed'

function getRoundStatus(matches: Match[], now: number): RoundStatus {
  const allClosed = matches.every(m => new Date(m.closes_at).getTime() < now)
  if (allClosed) return 'completed'
  
  const someOpen = matches.some(m => {
    const opens = new Date(m.opens_at).getTime()
    const closes = new Date(m.closes_at).getTime()
    return now >= opens && now < closes
  })
  if (someOpen) return 'in_progress'
  
  return 'upcoming'
}

export default function TournamentBracket(props: Props) {
  const { getCharacterText, t, getMatchStatus } = useI18n()
  const now = new Date(props.nowIso).getTime()
  const rounds = groupByRound(props.matches)
  const myVotes = props.myVotes ?? {}
  const flash = props.flash ?? {}

  // État pour gérer l'ouverture/fermeture des accordéons
  const [openRounds, setOpenRounds] = useState<Record<number, boolean>>(() => {
    // Par défaut, ouvrir les rounds en cours et à venir, fermer les complétés
    const initial: Record<number, boolean> = {}
    rounds.forEach(([round, ms]) => {
      const status = getRoundStatus(ms, now)
      initial[round] = status !== 'completed'
    })
    return initial
  })

  // Calculer le statut de chaque round
  const roundStatuses = useMemo(() => {
    const statuses: Record<number, RoundStatus> = {}
    rounds.forEach(([round, ms]) => {
      statuses[round] = getRoundStatus(ms, now)
    })
    return statuses
  }, [rounds, now])

  const toggleRound = (round: number) => {
    setOpenRounds(prev => ({ ...prev, [round]: !prev[round] }))
  }

  const resolveCharacter = (id?: number | null) => {
    if (!id) return { name: '—', description: undefined }
    const info = props.nameById[id]
    if (!info) return { name: `#${id}`, description: undefined }
    return getCharacterText({ slug: info.slug, name: info.name, description: info.description })
  }

  return (
    <div className="tournament-bracket">
      {rounds.map(([round, ms]) => {
        const status = roundStatuses[round]
        const isOpen = openRounds[round] ?? false
        
        // Calculer les dates min/max pour le round entier
        const roundOpens = Math.min(...ms.map(m => new Date(m.opens_at).getTime()))
        const roundCloses = Math.max(...ms.map(m => new Date(m.closes_at).getTime()))
        const roundBefore = now < roundOpens
        const roundDuring = now >= roundOpens && now < roundCloses
        
        const roundCountdown = roundBefore
          ? t('tournaments.statusOpens', { duration: formatDuration(roundOpens - now) })
          : roundDuring
            ? t('tournaments.statusEnds', { duration: formatDuration(roundCloses - now) })
            : null
        
        return (
          <div 
            key={round} 
            className={`tournament-bracket__round tournament-bracket__round--${status} ${isOpen ? 'tournament-bracket__round--open' : 'tournament-bracket__round--closed'}`}
          >
            <button 
              className="tournament-bracket__round-header"
              onClick={() => toggleRound(round)}
              aria-expanded={isOpen}
            >
              <div className="tournament-bracket__round-info">
                <span className="tournament-bracket__round-title">{t('tournaments.roundLabel', { round })}</span>
                <span className="tournament-bracket__round-time">
                  {new Date(roundOpens).toLocaleString()} → {new Date(roundCloses).toLocaleString()}
                </span>
              </div>
              <ChevronDown className="tournament-bracket__round-icon" size={20} />
            </button>

            {roundCountdown && isOpen && (
              <div className="tournament-bracket__countdown" aria-live="polite">
                <Timer size={16} className="tournament-bracket__countdown-icon" /> {roundCountdown}
              </div>
            )}
            
            {isOpen && (
              <div className="tournament-bracket__matches">
            {ms.map(m => {
              const opens = new Date(m.opens_at).getTime()
              const closes = new Date(m.closes_at).getTime()
              const during = now >= opens && now < closes
              const c1 = resolveCharacter(m.char1_id)
              const c2 = resolveCharacter(m.char2_id)
              const winner = resolveCharacter(m.winner_id ?? undefined)
              const userChoice = myVotes[m.id]
              const userChoseC1 = !!userChoice && m.char1_id === userChoice
              const userChoseC2 = !!userChoice && m.char2_id === userChoice
              const canVote = during && !!m.char1_id && !!m.char2_id && props.onVote && !userChoice && m.status === 'open'
              
              // Determine winner/loser classes
              const c1IsWinner = m.winner_id === m.char1_id
              const c2IsWinner = m.winner_id === m.char2_id
              const c1IsLoser = m.winner_id && m.winner_id === m.char2_id
              const c2IsLoser = m.winner_id && m.winner_id === m.char1_id

              return (
                <div key={m.id} className="tournament-bracket__match">
                  <div className="tournament-bracket__competitors">
                    <div className={`tournament-bracket__competitor ${c1IsWinner ? 'tournament-bracket__competitor--winner' : ''} ${c1IsLoser ? 'tournament-bracket__competitor--loser' : ''}`}>
                      <span className={`tournament-bracket__competitor-name ${userChoseC1 ? 'tournament-bracket__competitor-name--selected' : ''}`}>{c1.name}</span>
                      {canVote ? (
                        <button className="tournament-bracket__vote-button"
                                onClick={()=>props.onVote!(m.id, m.char1_id!)}>{t('tournaments.vote')}</button>
                      ) : (
                        <span className="tournament-bracket__votes">{m.char1_votes}</span>
                      )}
                    </div>
                    <div className={`tournament-bracket__competitor ${c2IsWinner ? 'tournament-bracket__competitor--winner' : ''} ${c2IsLoser ? 'tournament-bracket__competitor--loser' : ''}`}>
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
                        {getMatchStatus(m.status)}
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
            )}

            {props.isAdmin && props.onTick && round === rounds[rounds.length-1][0] && (
              <div className="tournament-bracket__admin">
                <button onClick={props.onTick} className="tournament-bracket__update-button">
                  {t('tournaments.update')}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

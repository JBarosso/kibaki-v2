import { useEffect, useMemo, useState } from 'react'
import { isAdmin } from '../lib/tournaments'
import { supabase } from '../lib/supabaseClient'
import { purgeOldTournaments } from '../lib/tournaments'
import { I18nProvider, useI18n, type Lang } from '@/i18n'

type Tournament = {
  id: string
  name: string
  status: 'scheduled'|'running'|'completed'|'canceled'
  started_at: string
  completed_at: string | null
}

type Props = {
  lang: Lang
}

export default function TournamentsListIsland(props: Props) {
  return (
    <I18nProvider lang={props.lang}>
      <TournamentsListInner {...props} />
    </I18nProvider>
  )
}

function TournamentsListInner(_: Props) {
  const { t, getTournamentStatus } = useI18n()
  const [items, setItems] = useState<Tournament[]>([])
  const [tab, setTab] = useState<'active'|'completed'>('active')
  const [admin, setAdmin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase
      .from('tournaments')
      .select('id,name,status,started_at,completed_at')
      .order('started_at', { ascending: false })
    if (!error) setItems(data ?? [])
  }

  useEffect(() => {
    isAdmin().then(setAdmin)
    load()
  }, [])

  const active = useMemo(
    () => items.filter(t => t.status === 'scheduled' || t.status === 'running'),
    [items]
  )
  const completed = useMemo(
    () => {
      if (admin) {
        // Admin sees both completed and canceled tournaments
        return items.filter(t => t.status === 'completed' || t.status === 'canceled')
      } else {
        // Non-admin only sees completed tournaments (canceled are hidden by RLS)
        return items.filter(t => t.status === 'completed')
      }
    },
    [items, admin]
  )

  async function onPurge() {
    if (!admin) return
    if (!confirm(t('tournaments.confirmPurge'))) return
    setBusy(true)
    try {
      const n = await purgeOldTournaments(365)
      setMessage(t('tournaments.purgeResult', { count: n }))
      await load()
      setTimeout(()=>setMessage(null), 3000)
    } finally {
      setBusy(false)
    }
  }

  const list = tab === 'active' ? active : completed

  return (
    <div className="tournaments-list">
      <div className="tournaments-list__header">
        <div className="tournaments-list__tabs">
          <button
            className={`tournaments-list__tab ${tab==='active'?'tournaments-list__tab--active':''}`}
            onClick={()=>setTab('active')}
          >{t('tournaments.activeTab')}</button>
          <button
            className={`tournaments-list__tab ${tab==='completed'?'tournaments-list__tab--active':''}`}
            onClick={()=>setTab('completed')}
          >{t('tournaments.completedTab')}</button>
        </div>
        {admin && (
          <button
            onClick={onPurge}
            disabled={busy}
            className={`tournaments-list__purge-button ${busy ? 'tournaments-list__purge-button--disabled' : ''}`}
          >
            {t('tournaments.purge')}
          </button>
        )}
      </div>

      {message && <div className="tournaments-list__message">{message}</div>}

      <ul className="tournaments-list__list">
        {list.map(t => (
          <li className="tournaments-list__item" key={t.id}>
            <a href={`/t/${t.id}`} className="tournaments-list__item-link">{t.name}</a>
            <div className="tournaments-list__item-info">
              {admin && t.status === 'canceled' && (
                <span className="tournaments-list__canceled-badge">
                  {t('tournaments.canceled')}
                </span>
              )}
              <span className="tournaments-list__item-status">{getTournamentStatus(t.status)}</span>
            </div>
          </li>
        ))}
        {list.length === 0 && (
          <li className="tournaments-list__empty">{t('tournaments.noTournaments')}</li>
        )}
      </ul>
    </div>
  )
}

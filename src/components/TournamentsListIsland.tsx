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
  const { t } = useI18n()
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
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex rounded-lg border overflow-hidden">
          <button
            className={`px-3 py-1 text-sm ${tab==='active'?'bg-black text-white':'bg-white'}`}
            onClick={()=>setTab('active')}
          >{t('tournaments.activeTab')}</button>
          <button
            className={`px-3 py-1 text-sm ${tab==='completed'?'bg-black text-white':'bg-white'}`}
            onClick={()=>setTab('completed')}
          >{t('tournaments.completedTab')}</button>
        </div>
        {admin && (
          <button
            onClick={onPurge}
            disabled={busy}
            className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {t('tournaments.purge')}
          </button>
        )}
      </div>

      {message && <div className="mb-3 text-sm text-green-700">{message}</div>}

      <ul className="divide-y divide-gray-200">
        {list.map(t => (
          <li className="py-4 flex items-center justify-between" key={t.id}>
            <a href={`/t/${t.id}`} className="font-medium hover:underline">{t.name}</a>
            <div className="flex items-center gap-2">
              {admin && t.status === 'canceled' && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {t('tournaments.canceled')}
                </span>
              )}
              <span className="text-sm text-gray-500">{t.status}</span>
            </div>
          </li>
        ))}
        {list.length === 0 && (
          <li className="py-6 text-sm text-gray-500">{t('tournaments.noTournaments')}</li>
        )}
      </ul>
    </div>
  )
}

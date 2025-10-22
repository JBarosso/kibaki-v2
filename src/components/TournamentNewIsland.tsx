import { useEffect, useMemo, useState } from 'react'
import { createTournament, isAdmin } from '../lib/tournaments'
import { supabase } from '../lib/supabaseClient'
import CustomSelect from '@/components/CustomSelect'
import { Input, Button, Field } from '@/components/Form'
import { I18nProvider, useI18n, type Lang } from '@/i18n'

type Character = { id: number; name: string; universe_id: number | null }
type Universe  = { id: number; name: string }

function toLocalDatetimeInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm   = pad(d.getMonth() + 1)
  const dd   = pad(d.getDate())
  const HH   = pad(d.getHours())
  const MM   = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${HH}:${MM}`
}

type Props = {
  lang: Lang
}

export default function TournamentNewIsland(props: Props) {
  return (
    <I18nProvider lang={props.lang}>
      <TournamentNewIslandInner />
    </I18nProvider>
  )
}

function TournamentNewIslandInner() {
  const { t } = useI18n()
  const [ok, setOk] = useState<boolean | null>(null)

  // Form
  const [name, setName] = useState('')
  const [universeId, setUniverseId] = useState<number | ''>('')

  // Round duration presets
  type Preset = 'custom' | '1d' | '1w' | '1m'
  const [preset, setPreset] = useState<Preset>('1w') // default 1 week
  const [customMinutes, setCustomMinutes] = useState<number>(10)

  // Start time (local input value)
  const [startLocal, setStartLocal] = useState<string>(
    toLocalDatetimeInputValue(new Date(Date.now() + 2 * 60_000))
  )

  // Data
  const [universes, setUniverses] = useState<Universe[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [filter, setFilter] = useState('')

  useEffect(() => { isAdmin().then(setOk) }, [])

  // Load universes list for the select
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('univers')
        .select('id,name')
        .order('name', { ascending: true })
      if (!error) setUniverses(data ?? [])
    })()
  }, [])

  // Load characters, optionally filtered by universe
  useEffect(() => {
    (async () => {
      let query = supabase
        .from('characters')
        .select('id,name,universe_id')
        .order('name', { ascending: true })
      if (universeId) query = query.eq('universe_id', universeId)
      const { data, error } = await query
      if (!error) setCharacters(data ?? [])
    })()
  }, [universeId])

  const filtered = useMemo(
    () => characters.filter(c => c.name.toLowerCase().includes(filter.toLowerCase())),
    [characters, filter]
  )

  const selectAll = () => setSelected(characters.map(c => c.id))
  const clearAll  = () => setSelected([])
  const toggle = (id: number) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  // Resolve minutes to send to RPC
  const resolvedMinutes = (() => {
    switch (preset) {
      case '1d': return 60 * 24
      case '1w': return 60 * 24 * 7
      case '1m': return 60 * 24 * 30
      default:   return Math.max(1, Number(customMinutes || 0))
    }
  })()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { alert('Name required'); return }
    if (selected.length < 2) { alert('Select at least 2 participants.'); return }

    const startIso = new Date(startLocal).toISOString()
    const tId = await createTournament({
      name,
      universe_id: universeId ? Number(universeId) : null,
      participants: selected,
      round_minutes: resolvedMinutes,
      start_iso: startIso,
    })
    window.location.href = `/t/${tId}`
  }

  if (ok === null) return (
    <div className="tournament-new__loading">
      {t('tournaments.checkingPermissions')}
    </div>
  )
  
  if (!ok) return (
    <div className="tournament-new__forbidden">
      {t('tournaments.adminOnly')}
    </div>
  )

  return (
    <form onSubmit={onSubmit} className="tournament-new__form">
      <div className="tournament-new__basic-info">
        <h2 className="tournament-new__section-title">{t('tournaments.basicInfo')}</h2>
        
        <div className="tournament-new__form-grid">
          <Field label={t('tournaments.tournamentName')} required htmlFor="name">
            <Input
              id="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('tournaments.namePlaceholder')}
              required
            />
          </Field>

          <Field label={t('tournaments.universe')} htmlFor="universe">
            <CustomSelect
              options={[
                { value: '', label: t('tournaments.allUniverses') },
                ...universes.map(u => ({ value: String(u.id), label: u.name }))
              ]}
              value={universeId === '' ? '' : String(universeId)}
              onChange={v => setUniverseId(v === '' ? '' : Number(v))}
            />
          </Field>
        </div>

        <div className="tournament-new__form-grid">
          <Field label={t('tournaments.roundDuration')} htmlFor="duration">
            <div className="tournament-new__duration-grid">
              <CustomSelect
                options={[
                  { value: '1d', label: t('tournaments.duration1d') },
                  { value: '1w', label: t('tournaments.duration1w') },
                  { value: '1m', label: t('tournaments.duration1m') },
                  { value: 'custom', label: t('tournaments.durationCustom') }
                ]}
                value={preset}
                onChange={v => setPreset(v as Preset)}
              />
              <Input
                type="number"
                min={1}
                value={customMinutes}
                onChange={e => setCustomMinutes(Number(e.target.value))}
                disabled={preset !== 'custom'}
                placeholder={t('tournaments.minutesPlaceholder')}
              />
            </div>
            <div className="tournament-new__duration-note">
              {t('tournaments.willUseMinutes', { minutes: resolvedMinutes })}
            </div>
          </Field>

          <Field label={t('tournaments.startTime')} required htmlFor="start-time">
            <Input
              id="start-time"
              type="datetime-local"
              value={startLocal}
              onChange={e => setStartLocal(e.target.value)}
              required
            />
          </Field>
        </div>
      </div>

      <div className="tournament-new__participants-section">
        <div className="tournament-new__participants-header">
          <h2 className="tournament-new__section-title">{t('tournaments.participantsTitle')}</h2>
          <div className="tournament-new__participants-controls">
            <Button type="button" onClick={selectAll} variant="ghost" buttonSize="small">
              {t('tournaments.selectAll')}
            </Button>
            <Button type="button" onClick={clearAll} variant="ghost" buttonSize="small">
              {t('tournaments.clearAll')}
            </Button>
            <Input
              type="search"
              placeholder={t('tournaments.searchParticipants')}
              value={filter}
              onChange={e => setFilter(e.target.value)}
              inputSize="small"
              className="tournament-new__participants-search"
            />
          </div>
        </div>

        <div className="tournament-new__participants-grid">
          {filtered.map(c => {
            const active = selected.includes(c.id)
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`tournament-new__participant-button ${active ? 'tournament-new__participant-button--active' : ''}`}
              >
                {c.name}
              </button>
            )
          })}
        </div>

        {selected.length > 0 && (
          <div className="tournament-new__seed-order">
            <h3 className="tournament-new__seed-title">{t('tournaments.seedOrder')}</h3>
            <ol className="tournament-new__seed-list">
              {selected.map((id) => {
                const c = characters.find(x => x.id === id)
                return (
                  <li key={id} className="tournament-new__seed-item">
                    {c?.name ?? `#${id}`}
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>

      <div className="tournament-new__actions">
        <Button type="submit" variant="primary" fullWidth>
          {t('tournaments.createTournament')}
        </Button>
      </div>
    </form>
  )
}
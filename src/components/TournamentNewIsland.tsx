import { useEffect, useMemo, useState } from 'react'
import { createTournament, isAdmin } from '../lib/tournaments'
import { supabase } from '../lib/supabaseClient'

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

export default function TournamentNewIsland() {
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

  if (ok === null) return <div className="text-sm text-gray-500">Checking permissions…</div>
  if (!ok) return <div className="text-red-600">Forbidden: admin only.</div>

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input className="mt-1 w-full rounded border px-3 py-2"
                 value={name} onChange={e=>setName(e.target.value)} required />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Universe (optional)</span>
          <select className="mt-1 w-full rounded border px-3 py-2"
                  value={universeId === '' ? '' : Number(universeId)}
                  onChange={e => setUniverseId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">All universes</option>
            {universes.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>

        <div className="block">
          <span className="text-sm font-medium">Round duration</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <select className="rounded border px-3 py-2"
                    value={preset}
                    onChange={e => setPreset(e.target.value as any)}>
              <option value="1d">1 day</option>
              <option value="1w">1 week</option>
              <option value="1m">1 month (30d)</option>
              <option value="custom">Custom (minutes)</option>
            </select>
            <input className="rounded border px-3 py-2 disabled:opacity-50"
                   type="number" min={1}
                   value={customMinutes}
                   onChange={e=>setCustomMinutes(Number(e.target.value))}
                   disabled={preset !== 'custom'}
                   placeholder="Minutes" />
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Will use <b>{resolvedMinutes}</b> minutes per round.
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Start time (local)</span>
          <input className="mt-1 w-full rounded border px-3 py-2"
                 type="datetime-local"
                 value={startLocal}
                 onChange={e=>setStartLocal(e.target.value)}
                 required />
        </label>
      </div>

      <div className="rounded border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-medium">Participants (click to add/remove, order = seed)</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={selectAll}
                    className="rounded border px-2 py-1 text-sm hover:bg-gray-50">Select all</button>
            <button type="button" onClick={clearAll}
                    className="rounded border px-2 py-1 text-sm hover:bg-gray-50">Clear</button>
            <input className="rounded border px-3 py-1 text-sm"
                   placeholder="Search…"
                   value={filter} onChange={e=>setFilter(e.target.value)} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-72 overflow-auto">
          {filtered.map(c => {
            const active = selected.includes(c.id)
            return (
              <button type="button" key={c.id}
                onClick={() => toggle(c.id)}
                className={`truncate rounded border px-2 py-1 text-left ${active ? 'bg-black text-white' : 'bg-white'}`}>
                {c.name}
              </button>
            )
          })}
        </div>

        {selected.length > 0 && (
          <div className="mt-4">
            <div className="text-sm text-gray-600 mb-1">Seed order:</div>
            <ol className="list-decimal ml-5 space-y-1">
              {selected.map((id) => {
                const c = characters.find(x => x.id === id)
                return <li key={id} className="text-sm">{c?.name ?? `#${id}`}</li>
              })}
            </ol>
          </div>
        )}
      </div>

      <button type="submit" className="rounded-md bg-black px-4 py-2 text-white hover:opacity-90">
        Create tournament
      </button>
    </form>
  )
}
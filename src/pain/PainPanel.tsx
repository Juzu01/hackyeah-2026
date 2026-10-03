// Bottom sheet shown while a body part is selected: rate the pain 1–10, pick its types, save to Supabase.
// Rendered outside .body-stage, so taps here never reach the map's gestures.

import { useEffect, useState } from 'react'
import { partLabel, type BodyPart } from '../body/anatomy.ts'
import { fetchPainHistory, fetchPainTypes, savePainReport, type PainEntry, type PainType } from '../lib/painReports.ts'
import { supabase } from '../lib/supabase.ts'

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** Green (1) → red (10). */
const levelColor = (n: number) => `hsl(${120 - ((n - 1) * 120) / 9} 70% 42%)`

const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Coś poszło nie tak.')

interface Props {
  part: BodyPart
  onClose: () => void
}

export default function PainPanel({ part, onClose }: Props) {
  const { title, subtitle } = partLabel(part)
  const [painTypes, setPainTypes] = useState<PainType[]>([])
  const [history, setHistory] = useState<PainEntry[]>([])
  const [intensity, setIntensity] = useState<number | null>(null)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'saved' } | { kind: 'error'; message: string }>({
    kind: 'idle',
  })

  useEffect(() => {
    if (!supabase) return
    let alive = true
    fetchPainTypes()
      .then((types) => alive && setPainTypes(types))
      .catch((err) => alive && setStatus({ kind: 'error', message: errorText(err) }))
    fetchPainHistory(part.id, 5)
      .then((entries) => alive && setHistory(entries))
      .catch(() => {}) // history is a bonus; the form still works without it
    return () => {
      alive = false
    }
  }, [part.id])

  const toggleType = (id: string) =>
    setSelectedTypes((ids) => (ids.includes(id) ? ids.filter((t) => t !== id) : [...ids, id]))

  const canSave = intensity !== null && selectedTypes.length > 0 && status.kind !== 'saving'

  const save = async () => {
    if (intensity === null) return
    setStatus({ kind: 'saving' })
    try {
      await savePainReport({ bodyPartId: part.id, intensity, painTypeIds: selectedTypes })
      setStatus({ kind: 'saved' })
      setIntensity(null)
      setSelectedTypes([])
      setHistory(await fetchPainHistory(part.id, 5))
    } catch (err) {
      setStatus({ kind: 'error', message: errorText(err) })
    }
  }

  return (
    <section
      aria-label={`Ból: ${title}`}
      className="fixed inset-x-0 bottom-0 z-20 mx-auto max-h-[70dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-b-0 border-cyan-200/30 bg-[#0a1020]/90 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-slate-100 shadow-[0_-8px_32px_rgb(0_0_0/0.45)] backdrop-blur-md"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg leading-tight font-semibold">{title}</h2>
          <p className="text-xs text-slate-400 italic">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij"
          className="-mt-1 -mr-1 rounded-full p-2 text-xl leading-none text-slate-400 hover:bg-white/10 hover:text-slate-100"
        >
          ×
        </button>
      </header>

      {!supabase ? (
        <p className="text-sm text-amber-300">
          Zapisywanie bólu jest wyłączone: brak konfiguracji Supabase. Skopiuj <code>.env.example</code> do{' '}
          <code>.env.local</code> i uruchom ponownie <code>npm run dev</code>.
        </p>
      ) : (
        <>
          <h3 className="mb-2 text-sm font-medium text-slate-300">Jak mocno boli?</h3>
          <div className="mb-1 grid grid-cols-10 gap-1">
            {LEVELS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={intensity === n}
                onClick={() => setIntensity(n)}
                style={intensity === n ? { backgroundColor: levelColor(n) } : undefined}
                className={`h-10 rounded-lg text-sm font-semibold tabular-nums transition-colors ${
                  intensity === n ? 'text-white ring-2 ring-white/70' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mb-4 flex justify-between text-[11px] text-slate-500">
            <span>lekki</span>
            <span>nie do zniesienia</span>
          </div>

          <h3 className="mb-2 text-sm font-medium text-slate-300">Jaki to ból?</h3>
          <div className="mb-4 flex flex-wrap gap-2">
            {painTypes.length === 0 && status.kind !== 'error' && <span className="text-sm text-slate-500">Ładowanie…</span>}
            {painTypes.map((t) => {
              const on = selectedTypes.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleType(t.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    on
                      ? 'border-cyan-300 bg-cyan-400/20 text-cyan-50'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {t.name_pl}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            disabled={!canSave}
            onClick={save}
            className="w-full rounded-xl bg-cyan-400 py-3 font-semibold text-slate-950 transition-opacity disabled:opacity-40"
          >
            {status.kind === 'saving' ? 'Zapisuję…' : 'Zapisz'}
          </button>

          <p role="status" className="mt-2 min-h-5 text-center text-sm">
            {status.kind === 'saved' && <span className="text-emerald-400">Zapisano.</span>}
            {status.kind === 'error' && <span className="text-rose-400">{status.message}</span>}
          </p>

          {history.length > 0 && (
            <div className="mt-2 border-t border-white/10 pt-3">
              <h3 className="mb-2 text-sm font-medium text-slate-300">Twoja historia</h3>
              <ul className="space-y-1.5">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 text-sm">
                    <span
                      className="w-8 shrink-0 rounded-md py-0.5 text-center text-xs font-semibold text-white tabular-nums"
                      style={{ backgroundColor: levelColor(h.intensity) }}
                    >
                      {h.intensity}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-slate-300">
                      {h.types.map((t) => t.name_pl.toLowerCase()).join(', ')}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{dateFormat.format(h.reportedAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

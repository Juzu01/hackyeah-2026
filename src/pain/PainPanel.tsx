// Bottom sheet for the selected part: rate the pain 1–10, pick its types, save to Supabase.
// Rendered outside the atlas host, so taps here never reach the viewer's gestures; the viewer
// is told about the sheet (via `ref`) and keeps the selected part visible above it.

import { useEffect, useState, type Ref } from 'react'
import type { PartInfo } from '../anatomy/content.ts'
import { fetchPainHistory, fetchPainTypes, savePainReport, type PainEntry, type PainType } from '../lib/painReports.ts'
import { supabase } from '../lib/supabase.ts'
import { painId } from './painId.ts'

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** Green (1) → red (10). */
const levelColor = (n: number) => `hsl(${120 - ((n - 1) * 120) / 9} 70% 42%)`

const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Coś poszło nie tak.')

/** "musculus biceps brachii · strona lewa"; no side when the name already says it ("Nerka lewa"). */
function subtitleOf(part: PartInfo): string {
  const sideInName = /\b(lew|praw)[aey]\b/i.test(part.name)
  return [part.latin, sideInName ? null : part.sideLabel].filter(Boolean).join(' · ')
}

const heading = 'mb-2.5 text-[10px] font-medium tracking-[0.16em] text-(--ink-3) uppercase'

interface Props {
  part: PartInfo
  onClose: () => void
  ref?: Ref<HTMLElement>
}

export default function PainPanel({ part, onClose, ref }: Props) {
  const bodyPartId = painId(part.id)
  const subtitle = subtitleOf(part)
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
    fetchPainHistory(bodyPartId, 5)
      .then((entries) => alive && setHistory(entries))
      .catch(() => {}) // history is a bonus; the form still works without it
    return () => {
      alive = false
    }
  }, [bodyPartId])

  const toggleType = (id: string) =>
    setSelectedTypes((ids) => (ids.includes(id) ? ids.filter((t) => t !== id) : [...ids, id]))

  const canSave = intensity !== null && selectedTypes.length > 0 && status.kind !== 'saving'

  const save = async () => {
    if (intensity === null) return
    setStatus({ kind: 'saving' })
    try {
      await savePainReport({ bodyPartId, intensity, painTypeIds: selectedTypes })
      setStatus({ kind: 'saved' })
      setIntensity(null)
      setSelectedTypes([])
      setHistory(await fetchPainHistory(bodyPartId, 5))
    } catch (err) {
      setStatus({ kind: 'error', message: errorText(err) })
    }
  }

  return (
    <section
      ref={ref}
      aria-label={`Ból: ${part.name}`}
      className="atlas-sheet fixed inset-x-0 bottom-0 z-20 mx-auto max-h-[62dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[6px] border border-b-0 border-(--hair) bg-(--panel) px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] font-(family-name:--font-sans) text-(--ink-1) shadow-[0_-12px_40px_rgb(0_0_0/0.5)] backdrop-blur-xl sm:px-5"
    >
      <header className="mb-5 flex items-start justify-between gap-3 border-b border-(--hair) pb-3.5">
        <div className="min-w-0">
          <p className="mb-1.5 text-[10px] font-semibold tracking-[0.16em] text-(--accent) uppercase">Zgłoszenie bólu</p>
          <h2 className="text-[18px] leading-tight font-semibold tracking-[-0.01em]">{part.name}</h2>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-(--ink-2) italic">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij"
          className="grid size-9 shrink-0 place-items-center rounded-[3px] border border-(--hair) text-(--ink-2) transition-colors hover:border-(--hair-strong) hover:text-(--ink-1)"
        >
          <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </header>

      {!supabase ? (
        <p className="mb-1 text-[13px] leading-[1.45] text-(--ink-2)">
          Zapisywanie bólu jest wyłączone: brak konfiguracji Supabase. Skopiuj{' '}
          <code className="font-(family-name:--font-mono) text-[12px] text-(--ink-1)">.env.example</code> do{' '}
          <code className="font-(family-name:--font-mono) text-[12px] text-(--ink-1)">.env.local</code> i uruchom ponownie{' '}
          <code className="font-(family-name:--font-mono) text-[12px] text-(--ink-1)">npm run dev</code>.
        </p>
      ) : (
        <>
          <h3 className={heading}>Jak mocno boli?</h3>
          <div className="mb-1.5 grid grid-cols-10 gap-1">
            {LEVELS.map((n) => {
              const on = intensity === n
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setIntensity(n)}
                  style={on ? { backgroundColor: levelColor(n), borderColor: levelColor(n) } : undefined}
                  className={`relative h-10 overflow-hidden rounded-[3px] border font-(family-name:--font-mono) text-[13px] tabular-nums transition-colors ${
                    on ? 'font-medium text-white' : 'border-(--hair) text-(--ink-2) hover:border-(--hair-strong) hover:text-(--ink-1)'
                  }`}
                >
                  {n}
                  {!on && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-0.5 opacity-70"
                      style={{ backgroundColor: levelColor(n) }}
                    />
                  )}
                </button>
              )
            })}
          </div>
          <div className="mb-5 flex justify-between text-[10.5px] text-(--ink-3)">
            <span>lekki</span>
            <span>nie do zniesienia</span>
          </div>

          <h3 className={heading}>Jaki to ból?</h3>
          <div className="mb-5 flex flex-wrap gap-1.5">
            {painTypes.length === 0 && status.kind !== 'error' && (
              <span className="text-[13px] text-(--ink-3)">Ładowanie…</span>
            )}
            {painTypes.map((t) => {
              const on = selectedTypes.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleType(t.id)}
                  className={`rounded-[3px] border px-3 py-1.5 text-[13px] transition-colors ${
                    on
                      ? 'border-(--accent) bg-(--accent)/10 text-(--ink-1)'
                      : 'border-(--hair) text-(--ink-2) hover:border-(--hair-strong) hover:text-(--ink-1)'
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
            className="h-11 w-full rounded-[3px] bg-(--accent) text-[11px] font-semibold tracking-[0.16em] text-(--bg-0) uppercase transition-opacity disabled:opacity-35"
          >
            {status.kind === 'saving' ? 'Zapisuję…' : 'Zapisz'}
          </button>

          <p role="status" className="mt-2 min-h-5 text-center text-[13px]">
            {status.kind === 'saved' && <span className="text-(--accent)">Zapisano.</span>}
            {status.kind === 'error' && <span className="text-rose-400">{status.message}</span>}
          </p>

          {history.length > 0 && (
            <div className="mt-2 border-t border-(--hair) pt-4">
              <h3 className={heading}>Twoja historia</h3>
              <ul className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 text-[13px]">
                    <span
                      className="w-7 shrink-0 rounded-[2px] py-0.5 text-center font-(family-name:--font-mono) text-[12px] font-medium text-white tabular-nums"
                      style={{ backgroundColor: levelColor(h.intensity) }}
                    >
                      {h.intensity}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-(--ink-2)">
                      {h.types.map((t) => t.name_pl.toLowerCase()).join(', ')}
                    </span>
                    <span className="shrink-0 font-(family-name:--font-mono) text-[11px] text-(--ink-3)">
                      {dateFormat.format(h.reportedAt)}
                    </span>
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

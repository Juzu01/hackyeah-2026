// Reporting pain in the selected part: rate it 1–10, pick its types, save to Supabase.
// Shown in the atlas's sheet in place of the part's card; "back" returns to the card.

import { useEffect, useState, type CSSProperties } from 'react'
import type { PartInfo } from '../anatomy/content.ts'
import { BackIcon } from '../atlas/icons.tsx'
import { fetchPainHistory, fetchPainTypes, savePainReport, type PainEntry, type PainType } from '../lib/painReports.ts'
import { supabase } from '../lib/supabase.ts'
import { painId } from './painId.ts'

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** Green (1) → red (10). */
const levelColor = (n: number) => `hsl(${120 - ((n - 1) * 120) / 9} 70% 42%)`
/** Text on a level's colour: dark on the bright greens to oranges, white on the reds (better contrast either way). */
const levelInk = (n: number) => (n >= 9 ? '#fff' : '#0b0f14')

const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Coś poszło nie tak.')

/** "musculus biceps brachii · strona lewa"; no side when the name already says it ("Nerka lewa"). */
function subtitleOf(part: PartInfo): string {
  const sideInName = /\b(lew|praw)[aey]\b/i.test(part.name)
  return [part.latin, sideInName ? null : part.sideLabel].filter(Boolean).join(' · ')
}

interface Props {
  part: PartInfo
  onBack: () => void
}

export default function PainPanel({ part, onBack }: Props) {
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
    <div className="pain">
      <header className="pain-head">
        <button type="button" className="icon-btn" aria-label="Wróć do opisu" onClick={onBack}>
          <BackIcon />
        </button>
        <div className="card-titles">
          <p className="tag">Zgłoś ból</p>
          <h2 className="card-name">{part.name}</h2>
          {subtitle && <p className="card-latin">{subtitle}</p>}
        </div>
      </header>

      {!supabase ? (
        <p className="pain-off">
          Zapisywanie bólu jest wyłączone: brak konfiguracji Supabase. Skopiuj <code>.env.example</code> do{' '}
          <code>.env.local</code> i uruchom ponownie <code>npm run dev</code>.
        </p>
      ) : (
        <>
          <h3 className="pain-q">Jak mocno boli?</h3>
          <div className="pain-levels" role="group" aria-label="Natężenie bólu od 1 do 10">
            {LEVELS.map((n) => {
              const on = intensity === n
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setIntensity(n)}
                  style={{ '--level': levelColor(n), '--level-ink': levelInk(n) } as CSSProperties}
                  className="pain-level"
                >
                  {n}
                </button>
              )
            })}
          </div>
          <p className="pain-scale">
            <span>1 · lekki</span>
            <span>10 · nie do zniesienia</span>
          </p>

          <h3 className="pain-q">Jaki to ból?</h3>
          <div className="pain-types">
            {painTypes.length === 0 && status.kind !== 'error' && <span className="pain-muted">Ładowanie…</span>}
            {painTypes.map((t) => {
              const on = selectedTypes.includes(t.id)
              return (
                <button key={t.id} type="button" aria-pressed={on} onClick={() => toggleType(t.id)} className="chip">
                  {t.name_pl}
                </button>
              )
            })}
          </div>

          <div className="sheet-actions">
            <button type="button" disabled={!canSave} onClick={save} className="btn-primary">
              {status.kind === 'saving' ? 'Zapisuję…' : 'Zapisz'}
            </button>
            <p role="status" className="pain-status">
              {status.kind === 'saved' && <span className="is-ok">Zapisano.</span>}
              {status.kind === 'error' && <span className="is-error">{status.message}</span>}
            </p>
          </div>

          {history.length > 0 && (
            <div className="pain-history">
              <h3 className="pain-q">Twoja historia</h3>
              <ul>
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="pain-badge" style={{ backgroundColor: levelColor(h.intensity), color: levelInk(h.intensity) }}>
                      {h.intensity}
                    </span>
                    <span className="pain-types-text">{h.types.map((t) => t.name_pl.toLowerCase()).join(', ')}</span>
                    <span className="pain-date">{dateFormat.format(h.reportedAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

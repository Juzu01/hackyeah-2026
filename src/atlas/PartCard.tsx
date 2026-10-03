// The selected part, in the sheet: what it is, a short description, "Więcej"
// for how it works (muscles: action and exercises; organs and bones: a fact,
// and how sport affects it), and the way into reporting pain.

import { useId, type ReactNode } from 'react'
import type { PartInfo } from '../anatomy/content.ts'
import { ChevronIcon, CloseIcon } from './icons.tsx'

interface Props {
  part: PartInfo
  expanded: boolean
  onToggle(): void
  onReport(): void
  onClose(): void
}

function moreOf(part: PartInfo): { title: string; body: ReactNode }[] {
  const out: { title: string; body: ReactNode }[] = []
  if (part.action) out.push({ title: 'Działanie', body: <p>{part.action}</p> })
  if (part.exercises?.length) {
    out.push({
      title: 'Ćwiczenia',
      body: (
        <ul>
          {part.exercises.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ),
    })
  }
  if (part.fact) out.push({ title: 'Ciekawostka', body: <p>{part.fact}</p> })
  if (part.sport) out.push({ title: 'Ruch i zdrowie', body: <p>{part.sport}</p> })
  return out
}

export default function PartCard({ part, expanded, onToggle, onReport, onClose }: Props) {
  const more = moreOf(part)
  const moreId = useId()
  return (
    <div className="card">
      <header className="card-head">
        <div className="card-titles">
          <p className="tag">{[part.groupLabel, part.sideLabel].filter(Boolean).join(' · ')}</p>
          <h2 className="card-name">{part.name}</h2>
          {part.latin && (
            <p className="card-latin" lang="la">
              {part.latin}
            </p>
          )}
        </div>
        <button type="button" className="icon-btn" aria-label="Zamknij" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      {part.description && <p className={`card-desc ${expanded ? '' : 'is-clamped'}`}>{part.description}</p>}

      {more.length > 0 && (
        <>
          <div id={moreId} className="card-more" hidden={!expanded}>
            {more.map((s) => (
              <section key={s.title}>
                <h3>{s.title}</h3>
                {s.body}
              </section>
            ))}
          </div>
          <button type="button" className="more-toggle" aria-expanded={expanded} aria-controls={moreId} onClick={onToggle}>
            {expanded ? 'Mniej' : 'Więcej'}
            <ChevronIcon up={expanded} />
          </button>
        </>
      )}

      <div className="sheet-actions">
        <button type="button" className="btn-primary" onClick={onReport}>
          Zgłoś ból
        </button>
      </div>
    </div>
  )
}

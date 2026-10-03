// The selected part, in plain words first: where it is ("Lewe udo, z przodu"),
// its name and one simple sentence, and the big "Zgłoś ból". "Więcej" holds the
// atlas detail for the curious: Latin, the clinical description, what it does,
// exercises, a fact, how sport affects it, and the body system.

import { useId, type ReactNode } from 'react'
import type { PartInfo } from '../anatomy/content.ts'
import { plainOf } from '../anatomy/plain.ts'
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
  if (part.latin) out.push({ title: 'Nazwa łacińska', body: <p lang="la">{part.latin}</p> })
  if (part.description) out.push({ title: 'Opis', body: <p>{part.description}</p> })
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
  out.push({ title: 'Układ', body: <p>{part.groupLabel}</p> })
  return out
}

export default function PartCard({ part, expanded, onToggle, onReport, onClose }: Props) {
  const plain = plainOf(part)
  const more = moreOf(part)
  const moreId = useId()
  return (
    <div className="card">
      <header className="card-head">
        <div className="card-titles">
          <p className="tag card-where" data-system={part.system}>
            <span className="swatch" aria-hidden="true" />
            {plain.where}
          </p>
          <h2 className="card-name">{part.name}</h2>
        </div>
        <button type="button" className="icon-btn" aria-label="Zamknij" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      {plain.simple && <p className="card-desc card-simple">{plain.simple}</p>}

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

      <div className="sheet-actions">
        <button type="button" className="btn-primary" onClick={onReport}>
          Zgłoś ból
        </button>
      </div>
    </div>
  )
}

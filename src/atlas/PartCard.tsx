// The selected part, in plain words first: where it is ("Lewe udo, z przodu"),
// its name and one simple sentence. "Więcej" opens the atlas detail for the
// curious, laid out by kind rather than as one list: the Latin name under the
// title, what it does in a lit box, how it's built, exercises as a numbered
// list, a fact and how sport affects it as cards, then its body system and a
// button that brings the part up close.

import { useId, type ReactNode } from 'react'
import type { PartInfo } from '../anatomy/content.ts'
import { plainOf } from '../anatomy/plain.ts'
import { ActionIcon, BuildIcon, ChevronIcon, CloseIcon, ExerciseIcon, FactIcon, HealthIcon, ZoomInIcon } from './icons.tsx'

interface Props {
  part: PartInfo
  expanded: boolean
  onToggle(): void
  onClose(): void
  /** Brings the part up close (and folds the card so it's visible). */
  onFocus(): void
}

/**
 * Polish typesetting: a one-letter word (w, z, i, a, o, u) never ends a line, and a number stays
 * with its unit ("20 l", "5 cm").
 */
function tidy(text: string): string {
  return text
    .replace(/(?<=^|[\s(])([aiouwzAIOUWZ]) /g, '$1\u00a0')
    .replace(/(\d) (?=(%|°C|ml|l|g|kg|mm|cm|m|km|min|s|h)(?![\p{L}\d]))/gu, '$1\u00a0')
}

function Block({ icon, title, tone, children }: { icon: ReactNode; title: string; tone?: 'lit' | 'box'; children: ReactNode }) {
  return (
    <section className={`more-block ${tone ? `is-${tone}` : ''}`}>
      <h3>
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

export default function PartCard({ part, expanded, onToggle, onClose, onFocus }: Props) {
  const plain = plainOf(part)
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
          {expanded && part.latin && (
            <p className="card-latin" lang="la">
              {part.latin}
            </p>
          )}
        </div>
        <button type="button" className="icon-btn" aria-label="Zamknij" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      {plain.simple && <p className="card-desc card-simple">{tidy(plain.simple)}</p>}

      <div id={moreId} className="card-more" hidden={!expanded}>
        {part.action && (
          <Block icon={<ActionIcon />} title="Co robi" tone="lit">
            <p>{tidy(part.action)}</p>
          </Block>
        )}
        {part.description && (
          <Block icon={<BuildIcon />} title={part.action ? 'Budowa' : 'Opis'}>
            <p>{tidy(part.description)}</p>
          </Block>
        )}
        {!!part.exercises?.length && (
          <Block icon={<ExerciseIcon />} title="Ćwiczenia">
            <ol className="more-steps">
              {part.exercises.map((x, i) => (
                <li key={x}>
                  <span className="more-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="more-step">{x}</span>
                </li>
              ))}
            </ol>
          </Block>
        )}
        {part.fact && (
          <Block icon={<FactIcon />} title="Ciekawostka" tone="box">
            <p>{tidy(part.fact)}</p>
          </Block>
        )}
        {part.sport && (
          <Block icon={<HealthIcon />} title="Ruch i zdrowie" tone="box">
            <p>{tidy(part.sport)}</p>
          </Block>
        )}
        <footer className="more-foot">
          <span className="more-chip" data-system={part.system}>
            <span className="swatch" aria-hidden="true" />
            {part.groupLabel}
          </span>
          <button type="button" className="more-zoom" onClick={onFocus}>
            <ZoomInIcon />
            Pokaż z bliska
          </button>
        </footer>
      </div>
      <button type="button" className="more-toggle" aria-expanded={expanded} aria-controls={moreId} onClick={onToggle}>
        {expanded ? 'Mniej' : 'Więcej'}
        <ChevronIcon up={expanded} />
      </button>
    </div>
  )
}

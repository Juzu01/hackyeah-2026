import { useMemo, useState, type KeyboardEvent } from 'react'
import { buildBodyModel } from '../body/anatomy.ts'
import { buildRegions, regionLabel, type Region, type View } from '../body/regions.ts'

interface Props {
  view: View
  /** Region whose symptom list is open. */
  active?: string
  /** Number of symptoms picked per region id; regions with picks stay lit. */
  counts: ReadonlyMap<string, number>
  onSelect: (region: Region) => void
  onHover?: (region: Region | null) => void
  className?: string
}

const VIEW_BOX = '-186 -10 372 856'

/**
 * Clickable silhouette ("where does it hurt?") in a soft light. Its regions show as faint seams
 * so it's clear where to tap, light up under the finger, and stay lit once something there is
 * picked. Turning between front and back spins the figure. The back view flips the figure so its
 * left stays on the viewer's left.
 */
export default function BodyMap({ view, active, counts, onSelect, onHover, className }: Props) {
  const skin = useMemo(() => buildBodyModel().skin, [])
  const regions = useMemo(() => buildRegions(view), [view])
  const [hovered, setHovered] = useState<string | null>(null)
  const flip = view === 'back'

  const hover = (r: Region | null) => {
    setHovered(r?.id ?? null)
    onHover?.(r)
  }
  const onKey = (e: KeyboardEvent, r: Region) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(r)
    }
  }

  return (
    <svg viewBox={VIEW_BOX} className={`bodymap ${className ?? ''}`} role="group" aria-label={flip ? 'Mapa ciała, widok z tyłu' : 'Mapa ciała, widok z przodu'}>
      <defs>
        <clipPath id={`skin-${view}`}>
          {skin.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>
        <radialGradient id="bm-glow" cx="0" cy="360" r="330" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--green)', stopOpacity: 0.16 }} />
          <stop offset="0.55" style={{ stopColor: 'var(--green)', stopOpacity: 0.05 }} />
          <stop offset="1" style={{ stopColor: 'var(--green)', stopOpacity: 0 }} />
        </radialGradient>
      </defs>

      <ellipse cx="0" cy="360" rx="330" ry="420" fill="url(#bm-glow)" />

      {/* Keyed by the view, so turning around replays the spin. */}
      <g key={view} className="bm-turn">
        <g transform={flip ? 'scale(-1 1)' : undefined}>
          {skin.map((d, i) => (
            <path key={i} d={d} className="bm-skin" />
          ))}
          <g clipPath={`url(#skin-${view})`}>
            {regions.map((r) => {
              const picked = (counts.get(r.id) ?? 0) > 0
              const state = active === r.id ? 'is-active' : picked ? 'is-picked' : hovered === r.id ? 'is-hover' : ''
              return (
                <g
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active === r.id || picked}
                  aria-label={regionLabel(r)}
                  className={`bm-zone ${state}`}
                  onClick={() => onSelect(r)}
                  onKeyDown={(e) => onKey(e, r)}
                  onMouseEnter={() => hover(r)}
                  onMouseLeave={() => hover(null)}
                  onFocus={() => hover(r)}
                  onBlur={() => hover(null)}
                >
                  <title>{regionLabel(r)}</title>
                  {r.paths.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </g>
              )
            })}
          </g>
          {skin.map((d, i) => (
            <path key={`edge-${i}`} d={d} className="bm-edge" />
          ))}
        </g>
      </g>

    </svg>
  )
}

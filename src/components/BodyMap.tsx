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
/** The ground under the feet rises left to right at the slope of Doco's horizon (16 in 360). */
const GROUND = { x1: -186, y1: 818, x2: 186, y2: 801.5 }

/**
 * Clickable silhouette ("where does it hurt?"). The figure stands on Doco's slanted horizon in
 * a soft light; its regions show as faint seams so it's clear where to tap, light up under the
 * finger, and stay lit with a diamond count once something there is picked. Turning between
 * front and back spins the figure; each time it appears, one scan line passes down the body.
 * The back view flips the figure so its left stays on the viewer's left.
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
        <linearGradient id="bm-ground" x1={GROUND.x1} x2={GROUND.x2} y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--green)', stopOpacity: 0 }} />
          <stop offset="0.5" style={{ stopColor: 'var(--green)', stopOpacity: 0.85 }} />
          <stop offset="1" style={{ stopColor: 'var(--green)', stopOpacity: 0 }} />
        </linearGradient>
        <linearGradient id="bm-scan" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--green)', stopOpacity: 0 }} />
          <stop offset="0.85" style={{ stopColor: 'var(--green)', stopOpacity: 0.22 }} />
          <stop offset="1" style={{ stopColor: 'var(--green)', stopOpacity: 0.7 }} />
        </linearGradient>
      </defs>

      <ellipse cx="0" cy="360" rx="330" ry="420" fill="url(#bm-glow)" />
      <line className="bm-ground" {...GROUND} stroke="url(#bm-ground)" />
      <line className="bm-ground is-far" x1={GROUND.x1 + 70} y1={GROUND.y1 + 22} x2={GROUND.x2 - 70} y2={GROUND.y2 + 22} stroke="url(#bm-ground)" />

      {/* Keyed by the view, so turning around replays the spin and the scan. */}
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
            <rect className="bm-scan" x="-186" y="-130" width="372" height="120" fill="url(#bm-scan)" pointerEvents="none" />
          </g>
          {skin.map((d, i) => (
            <path key={`edge-${i}`} d={d} className="bm-edge" />
          ))}
        </g>
      </g>

      {/* Counts as diamonds, drawn unflipped so the digits read correctly in the back view; a slow
          ring goes out from each, like a pulse: it hurts here. */}
      {regions.map((r) => {
        const n = counts.get(r.id) ?? 0
        if (!n) return null
        const x = flip ? -r.labelAt[0] : r.labelAt[0]
        const y = r.labelAt[1]
        return (
          <g key={`badge-${r.id}`} className="bm-badge" transform={`translate(${x} ${y})`} pointerEvents="none" aria-hidden="true">
            <rect className="bm-pulse" x="-17" y="-17" width="34" height="34" />
            <rect x="-17" y="-17" width="34" height="34" transform="rotate(45)" />
            <text y="8" textAnchor="middle">
              {n}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

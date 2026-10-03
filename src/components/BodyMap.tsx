import { useMemo, useState, type KeyboardEvent } from 'react'
import { buildBodyModel } from '../body/anatomy.ts'
import { buildRegions, regionLabel, type Region, type View } from '../body/regions.ts'

interface Props {
  view: View
  /** Region whose symptom list is open. */
  active?: string
  /** Number of symptoms picked per region id; regions with picks stay highlighted. */
  counts: ReadonlyMap<string, number>
  onSelect: (region: Region) => void
  onHover?: (region: Region | null) => void
  className?: string
}

const VIEW_BOX = '-186 -10 372 828'

/**
 * Clickable silhouette ("where does it hurt?"). Regions are invisible until
 * hovered or selected, so the figure reads as one body, the way WebMD's map
 * works. The back view flips the figure so its left stays on the viewer's left.
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
    <svg viewBox={VIEW_BOX} className={className} role="group" aria-label={flip ? 'Mapa ciała, widok z tyłu' : 'Mapa ciała, widok z przodu'}>
      <defs>
        <clipPath id={`skin-${view}`}>
          {skin.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>
      </defs>
      <g transform={flip ? 'scale(-1 1)' : undefined}>
        {skin.map((d, i) => (
          <path key={i} d={d} className="fill-sky-100 stroke-sky-300" strokeWidth={1.2} />
        ))}
        <g clipPath={`url(#skin-${view})`}>
          {regions.map((r) => {
            const picked = (counts.get(r.id) ?? 0) > 0
            const isActive = active === r.id
            const isHover = hovered === r.id
            const cls = isActive
              ? 'fill-teal-600/75 stroke-teal-800'
              : picked
                ? 'fill-teal-500/45 stroke-teal-700'
                : isHover
                  ? 'fill-teal-400/40 stroke-teal-600'
                  : 'fill-transparent stroke-transparent'
            return (
              <g
                key={r.id}
                role="button"
                tabIndex={0}
                aria-pressed={isActive || picked}
                aria-label={regionLabel(r)}
                className="cursor-pointer outline-none focus-visible:[&>path]:stroke-teal-700"
                onClick={() => onSelect(r)}
                onKeyDown={(e) => onKey(e, r)}
                onMouseEnter={() => hover(r)}
                onMouseLeave={() => hover(null)}
                onFocus={() => hover(r)}
                onBlur={() => hover(null)}
              >
                <title>{regionLabel(r)}</title>
                {r.paths.map((d, i) => (
                  <path key={i} d={d} className={cls} strokeWidth={isActive || picked ? 2 : 1.5} strokeLinejoin="round" />
                ))}
              </g>
            )
          })}
        </g>
      </g>
      {/* Count badges, drawn unflipped so the digits read correctly in the back view. */}
      {regions.map((r) => {
        const n = counts.get(r.id) ?? 0
        if (!n) return null
        const x = flip ? -r.labelAt[0] : r.labelAt[0]
        const y = r.labelAt[1]
        return (
          <g key={`badge-${r.id}`} pointerEvents="none" aria-hidden="true">
            <circle cx={x} cy={y} r={13} className="fill-teal-800 stroke-white" strokeWidth={2} />
            <text x={x} y={y + 5} textAnchor="middle" className="fill-white text-[15px] font-bold" style={{ fontFamily: 'inherit' }}>
              {n}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

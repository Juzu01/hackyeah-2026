import { useLayoutEffect, useRef, useState } from 'react'
import { symptomName } from '../data/symptoms.ts'
import type { Pick } from '../lib/check.ts'

interface Props {
  picks: Pick[]
  onRemove: (symptomId: string) => void
}

/** Rows the pills keep to while folded. */
const ROWS = 2
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)'

/**
 * The picked symptoms as pills that wrap inside the screen, never past its edge. The newest comes
 * first and pops in; the others glide to their new places, so adding and removing reads as the pills
 * making room for each other. Folded, they keep to two rows and the rest wait behind a "+3" pill that
 * opens them all.
 */
export default function PickedChips({ picks, onRemove }: Props) {
  const [open, setOpen] = useState(false)
  const [fit, setFit] = useState(picks.length)
  const list = useRef<HTMLUListElement>(null)
  const width = useRef(0)
  const places = useRef(new Map<string, { x: number; y: number }>())
  const newestFirst = [...picks].reverse()
  const key = newestFirst.map((p) => p.symptomId).join('|')

  // Measure again from "everything fits" whenever the pills or the width change…
  const [measured, setMeasured] = useState(key)
  if (measured !== key) {
    setMeasured(key)
    setFit(picks.length)
  }
  useLayoutEffect(() => {
    const ul = list.current
    if (!ul) return
    const observer = new ResizeObserver(() => {
      if (ul.clientWidth === width.current) return
      width.current = ul.clientWidth
      setFit(picks.length)
    })
    observer.observe(ul)
    return () => observer.disconnect()
  }, [picks.length])

  // …then, folded, drop pills until the "+N" pill still ends on the second row.
  useLayoutEffect(() => {
    const ul = list.current
    if (!ul || open) return
    const rows = new Set([...ul.children].map((li) => (li as HTMLElement).offsetTop)).size
    if (rows > ROWS && fit > 1) setFit(fit - 1)
  })

  // Pills that moved since the last frame glide from where they were (positions within the list,
  // so scrolling the page doesn't count as moving).
  useLayoutEffect(() => {
    const ul = list.current
    if (!ul) return
    const next = new Map<string, { x: number; y: number }>()
    for (const child of ul.children) {
      const li = child as HTMLElement
      const at = { x: li.offsetLeft, y: li.offsetTop }
      const id = li.dataset.id!
      next.set(id, at)
      const was = places.current.get(id)
      if (was && (was.x !== at.x || was.y !== at.y) && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        li.animate([{ transform: `translate(${was.x - at.x}px, ${was.y - at.y}px)` }, { transform: 'none' }], { duration: 300, easing: EASE })
      }
    }
    places.current = next
  })

  const shown = open ? newestFirst : newestFirst.slice(0, fit)
  const hidden = picks.length - shown.length

  return (
    <ul ref={list} className={`tray-chips ${open ? 'is-open' : ''}`} aria-label={`Twoje objawy (${picks.length})`}>
      {shown.map((p) => (
        <li key={p.symptomId} data-id={p.symptomId} className="tray-chip-item">
          <button type="button" onClick={() => onRemove(p.symptomId)} className="tray-chip" aria-label={`Usuń objaw: ${symptomName(p.symptomId)}`}>
            <span className="truncate">{symptomName(p.symptomId)}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </li>
      ))}
      {hidden > 0 && (
        <li key="more" data-id="more">
          <button type="button" onClick={() => setOpen(true)} className="tray-chip is-more" aria-label={`Pokaż wszystkie objawy (${picks.length})`}>
            +{hidden}
          </button>
        </li>
      )}
      {open && (
        <li key="less" data-id="less">
          <button type="button" onClick={() => setOpen(false)} className="tray-chip is-more">
            Zwiń
          </button>
        </li>
      )}
    </ul>
  )
}

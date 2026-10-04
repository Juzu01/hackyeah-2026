import type { CSSProperties } from 'react'

interface Props {
  /** 1 where it hurts, 2 the questions, 3 the result. */
  current: 1 | 2 | 3
  /** How far into the current step (0–1); the questions fill their blade as they're answered. */
  progress?: number
}

const STEPS = ['Miejsce', 'Pytania', 'Wynik']

/**
 * The whole check at a glance: three slanted blades like Doco's tab bar. Done steps carry a
 * tick, the current one is lit and its top edge fills up as you go, the rest wait in grey.
 */
export default function Steps({ current, progress = 1 }: Props) {
  return (
    <ol className="steps print:hidden" aria-label="Etapy oceny">
      {STEPS.map((label, i) => {
        const n = i + 1
        const state = n < current ? 'done' : n === current ? 'now' : 'next'
        const fill = n < current ? 1 : n === current ? Math.max(0.04, Math.min(1, progress)) : 0
        return (
          <li key={label} className="step" data-state={state} aria-current={state === 'now' ? 'step' : undefined} style={{ '--fill': fill } as CSSProperties}>
            <span className="step-n" aria-hidden="true">
              {state === 'done' ? (
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="square">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              ) : (
                n
              )}
            </span>
            <span>
              <span className="sr-only">{state === 'done' ? 'Zrobione: ' : state === 'now' ? 'Teraz: ' : 'Potem: '}</span>
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

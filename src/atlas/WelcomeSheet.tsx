// The first visit: what the atlas is for, three tiny tips and a big "Zaczynamy".
// Shown once (re-openable from "i"); closing it any way counts as seen.

import { useEffect, useRef } from 'react'
import { LAYERS } from './layers.tsx'
import { CloseIcon, TapIcon } from './icons.tsx'

interface Props {
  touch: boolean
  onDone(): void
}

export default function WelcomeSheet({ touch, onDone }: Props) {
  const start = useRef<HTMLButtonElement>(null)
  useEffect(() => start.current?.focus(), [])
  return (
    <div className="onboard">
      <header className="card-head">
        <div className="card-titles">
          <p className="tag">Witaj</p>
          <h2 className="card-name">Atlas ciała</h2>
        </div>
        <button type="button" className="icon-btn" aria-label="Pomiń" onClick={onDone}>
          <CloseIcon />
        </button>
      </header>
      <p className="onboard-lead">Poznaj swoje ciało i zapisz, co cię boli.</p>

      <ol className="onboard-tips">
        <li>
          <span className="onboard-art" aria-hidden="true">
            <TapIcon />
          </span>
          <span>
            <strong>{touch ? 'Dotknij' : 'Kliknij'} części ciała</strong>, żeby zobaczyć, co to jest.
          </span>
        </li>
        <li>
          <span className="onboard-art onboard-art-layers" aria-hidden="true">
            {LAYERS.muscles.icon}
            {LAYERS.organs.icon}
          </span>
          <span>
            <strong>Przyciski {LAYERS.muscles.label} i {LAYERS.organs.label}</strong> pokazują, co jest głębiej.
          </span>
        </li>
        <li>
          <span className="onboard-art onboard-art-pain" aria-hidden="true">
            Zgłoś ból
          </span>
          <span>
            <strong>Zgłoś ból</strong> w wybranym miejscu i śledź, jak się zmienia.
          </span>
        </li>
      </ol>

      <div className="sheet-actions">
        <button ref={start} type="button" className="btn-primary" onClick={onDone}>
          Zaczynamy
        </button>
      </div>
    </div>
  )
}

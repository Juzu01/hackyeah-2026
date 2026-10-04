// Whose body: a woman's or a man's. The depth gauge's small sibling in the bottom-left corner, out of
// the way of the voice button; both bodies are the same anatomy (tools/anatomy/shapes.mjs).

import type { ReactNode } from 'react'
import type { Body } from '../anatomy/model.ts'
import { FemaleIcon, MaleIcon } from './icons.tsx'

interface Props {
  value: Body
  onChange(body: Body): void
  hidden?: boolean
}

const BODIES: { body: Body; label: string; icon: ReactNode }[] = [
  { body: 'f', label: 'Kobieta', icon: <FemaleIcon /> },
  { body: 'm', label: 'Mężczyzna', icon: <MaleIcon /> },
]

export default function BodySwitch({ value, onChange, hidden }: Props) {
  return (
    <div className={`bodies ${hidden ? 'is-hidden' : ''}`} role="radiogroup" aria-label="Czyje ciało pokazać" aria-hidden={hidden || undefined}>
      {BODIES.map(({ body, label, icon }) => (
        <button
          key={body}
          type="button"
          role="radio"
          aria-checked={body === value}
          tabIndex={hidden ? -1 : undefined}
          className="bodies-btn on-scene"
          onClick={() => body !== value && onChange(body)}
        >
          {icon}
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}

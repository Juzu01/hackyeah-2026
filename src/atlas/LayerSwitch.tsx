// The depth gauge: which layer of the body to look at, top to bottom from the
// surface inwards. It mirrors the depth live (pinching changes it too) and moves
// the camera when tapped. One button
// per layer; the short caption a tap shows is App's separate .layer-caption.

import type { CSSProperties } from 'react'
import { LAYER_NAMES, type LayerName } from '../anatomy/depth.ts'
import { LAYERS } from './layers.tsx'

interface Props {
  value: LayerName
  onChange(layer: LayerName): void
  hidden?: boolean
}

export default function LayerSwitch({ value, onChange, hidden }: Props) {
  const index = LAYER_NAMES.indexOf(value)
  return (
    <div className={`layers ${hidden ? 'is-hidden' : ''}`} role="radiogroup" aria-label="Warstwa ciała" aria-hidden={hidden || undefined}>
      <span className="layers-thumb" style={{ '--i': index } as CSSProperties} aria-hidden="true" />
      {LAYER_NAMES.map((layer) => (
        <button
          key={layer}
          type="button"
          role="radio"
          aria-checked={layer === value}
          tabIndex={hidden ? -1 : undefined}
          data-layer={layer}
          className="layers-btn on-scene"
          onClick={() => onChange(layer)}
        >
          {LAYERS[layer].icon}
          <span>{LAYERS[layer].label}</span>
        </button>
      ))}
    </div>
  )
}

// The title bar: the app's name and two round buttons, turn the body round and info.

import { FlipIcon, InfoIcon } from './icons.tsx'

interface Props {
  back: boolean
  onFlip(): void
  onInfo(): void
}

export default function TopBar({ back, onFlip, onInfo }: Props) {
  const flipLabel = back ? 'Pokaż przód ciała' : 'Pokaż tył ciała'
  return (
    <header className="topbar">
      <h1 className="topbar-title">Atlas ciała</h1>
      <div className="topbar-actions">
        <button type="button" className="round-btn" aria-label={flipLabel} title={flipLabel} onClick={onFlip}>
          <FlipIcon />
        </button>
        <button type="button" className="round-btn" aria-label="Jak korzystać i informacje" title="Informacje" onClick={onInfo}>
          <InfoIcon />
        </button>
      </div>
    </header>
  )
}

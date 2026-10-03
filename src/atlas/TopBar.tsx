// The title bar: the app's name and its buttons: search, turn the body round
// (a pill that says which side you'll see, so nobody has to guess the icon), info.

import { FlipIcon, InfoIcon, SearchIcon } from './icons.tsx'

interface Props {
  back: boolean
  onSearch(): void
  onFlip(): void
  onInfo(): void
}

export default function TopBar({ back, onSearch, onFlip, onInfo }: Props) {
  const flipLabel = back ? 'Pokaż przód ciała' : 'Pokaż tył ciała'
  return (
    <header className="topbar">
      <h1 className="topbar-title">Atlas ciała</h1>
      <div className="topbar-actions">
        <button type="button" className="round-btn" aria-label="Szukaj części ciała" title="Szukaj" onClick={onSearch}>
          <SearchIcon />
        </button>
        <button type="button" className="pill-btn" aria-label={flipLabel} title={flipLabel} onClick={onFlip}>
          <FlipIcon />
          {back ? 'Przód' : 'Tył'}
        </button>
        <button type="button" className="round-btn" aria-label="Jak korzystać i informacje" title="Informacje" onClick={onInfo}>
          <InfoIcon />
        </button>
      </div>
    </header>
  )
}

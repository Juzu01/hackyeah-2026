// Finding a part without knowing its name: type an everyday word ("kolano",
// "plecy", "lewa łydka") or tap a suggestion, then pick a result to fly there.

import { useEffect, useMemo, useRef, useState } from 'react'
import { suggestions } from '../anatomy/plain.ts'
import { search } from '../anatomy/search.ts'
import { CloseIcon, SearchIcon } from './icons.tsx'

interface Props {
  initial?: string
  onPick(id: string): void
  onClose(): void
}

export default function SearchSheet({ initial = '', onPick, onClose }: Props) {
  const [query, setQuery] = useState(initial)
  const input = useRef<HTMLInputElement>(null)
  const hits = useMemo(() => search(query), [query])
  useEffect(() => input.current?.focus(), [])

  return (
    <div className="search">
      <header className="card-head">
        <div className="card-titles">
          <h2 className="card-name">Szukaj w ciele</h2>
        </div>
        <button type="button" className="icon-btn" aria-label="Zamknij" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      <label className="search-field">
        <SearchIcon />
        <input
          ref={input}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          aria-label="Szukaj części ciała"
          placeholder="Np. kolano, plecy, serce"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && hits[0]) onPick(hits[0].id)
          }}
        />
      </label>

      {!query.trim() && (
        <div className="search-suggestions" aria-label="Podpowiedzi">
          {suggestions.map((s) => (
            <button key={s.query} type="button" className="chip" onClick={() => setQuery(s.query)}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {query.trim() && hits.length === 0 && (
        <p className="search-empty">Nic nie znaleziono. Spróbuj innego słowa, np. „ręka” albo „brzuch”.</p>
      )}

      {hits.length > 0 && (
        <ul className="search-results" aria-label="Wyniki">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" className="search-result" data-id={h.id} onClick={() => onPick(h.id)}>
                <span className="search-result-text">
                  <span className="search-result-name">{h.name}</span>
                  <span className="search-result-where">{h.where}</span>
                </span>
                <span className="search-result-kind">{h.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

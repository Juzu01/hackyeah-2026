import { useEffect, useRef, useState } from 'react'
import { searchSymptoms } from '../data/symptoms.ts'
import type { Sex, Symptom } from '../data/types.ts'

interface Props {
  sex?: Sex
  picked: ReadonlySet<string>
  onPick: (symptom: Symptom) => void
  autoFocus?: boolean
}

/** Typeahead over the symptom catalogue: the alternative to clicking the body. */
export default function SymptomSearch({ sex, picked, onPick, autoFocus }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const results = searchSymptoms(query, sex)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const choose = (s: Symptom) => {
    onPick(s)
    setQuery('')
    setOpen(false)
    setCursor(0)
  }

  return (
    <div ref={box} className="relative">
      <label htmlFor="symptom-search" className="sr-only">
        Wyszukaj objaw
      </label>
      <div className="field flex min-h-12 items-center gap-2.5 px-3">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-ink-2" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          id="symptom-search"
          type="search"
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          placeholder="Wpisz objaw, np. kaszel, zgaga"
          className="w-full bg-transparent py-2 text-base"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setCursor(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCursor((c) => Math.min(results.length - 1, c + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => Math.max(0, c - 1))
            } else if (e.key === 'Enter' && results[cursor]) {
              e.preventDefault()
              choose(results[cursor])
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="symptom-search-list"
          aria-autocomplete="list"
        />
      </div>
      {open && query.trim().length >= 2 && (
        <ul id="symptom-search-list" role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line-2 bg-s1 py-1">
          {results.length === 0 && <li className="px-3 py-2.5 text-base text-ink-2">Nie znaleziono. Spróbuj innego słowa albo wskaż miejsce na sylwetce.</li>}
          {results.map((s, i) => {
            const already = picked.has(s.id)
            return (
              <li
                key={s.id}
                role="option"
                aria-selected={i === cursor}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-base ${i === cursor ? 'bg-s2 shadow-[inset_2px_0_0_var(--green)]' : ''} ${already ? 'text-ink-2' : 'text-ink'}`}
                onMouseEnter={() => setCursor(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => !already && choose(s)}
              >
                <span>{s.name}</span>
                {already && <span className="text-sm text-green">dodano</span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

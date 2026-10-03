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
      <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          id="symptom-search"
          type="search"
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          placeholder="Wpisz objaw, np. ból głowy, zgaga, kaszel"
          className="w-full bg-transparent text-base outline-none placeholder:text-slate-400"
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
        <ul id="symptom-search-list" role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Nie znaleziono. Spróbuj innego słowa albo wskaż miejsce na sylwetce.</li>}
          {results.map((s, i) => {
            const already = picked.has(s.id)
            return (
              <li
                key={s.id}
                role="option"
                aria-selected={i === cursor}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${i === cursor ? 'bg-teal-50' : ''} ${already ? 'text-slate-400' : 'text-slate-800'}`}
                onMouseEnter={() => setCursor(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => !already && choose(s)}
              >
                <span>{s.name}</span>
                {already && <span className="text-xs">dodano</span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

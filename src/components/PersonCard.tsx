import { useRef, useState } from 'react'
import { SYMPTOM_BY_ID } from '../data/symptoms.ts'
import type { Pregnancy, Sex } from '../data/types.ts'
import { canBePregnant, type CheckDraft, type ForWhom } from '../lib/check.ts'
import Segmented from './Segmented.tsx'

interface Props {
  draft: CheckDraft
  update: (patch: Partial<CheckDraft>) => void
  /** Sex or age missing when "Dalej" was pressed. */
  invalid: boolean
  onEdit: () => void
}

/** "34 lata", "25 lat", "1 rok". */
export function years(n: number): string {
  if (n === 1) return '1 rok'
  const last = n % 10
  const lastTwo = n % 100
  return `${n} ${last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'lata' : 'lat'}`
}

const PREGNANCY_LINE: Record<Pregnancy, string> = { yes: 'w ciąży', unknown: 'możliwa ciąża', no: '' }

/**
 * Who the check is for, their sex and age, and for women of childbearing age whether they're
 * pregnant. A small form until it's filled in; then one line ("Dla mnie · kobieta · 34 lata")
 * that opens again with a tap, so the body keeps the screen.
 */
export default function PersonCard({ draft, update, invalid, onEdit }: Props) {
  const complete = !!draft.sex && draft.age !== undefined && !Number.isNaN(draft.age)
  // Open while it's being filled in; a profile remembered from last time starts folded.
  const [editing, setEditing] = useState(false)
  const card = useRef<HTMLDivElement>(null)
  const open = editing || !complete || invalid
  const changed = (patch: Partial<CheckDraft>) => {
    // A different sex drops what belongs to the other one: the pregnancy answer, the period.
    if (patch.sex && patch.sex !== draft.sex) {
      const sex = patch.sex
      patch = { ...patch, picks: draft.picks.filter((p) => (SYMPTOM_BY_ID.get(p.symptomId)?.sex ?? sex) === sex) }
      if (sex !== 'f') patch.pregnancy = undefined
    }
    update(patch)
    setEditing(true)
    onEdit()
  }

  if (!open) {
    const who = draft.forWhom === 'me' ? 'Dla mnie' : 'Dla kogoś innego'
    const sex = draft.sex === 'f' ? 'kobieta' : 'mężczyzna'
    const pregnancy = canBePregnant(draft) && draft.pregnancy ? PREGNANCY_LINE[draft.pregnancy] : ''
    return (
      <button type="button" className="person-line cut" onClick={() => setEditing(true)} aria-label={`${who}, ${sex}, ${years(draft.age!)}${pregnancy ? `, ${pregnancy}` : ''}. Zmień`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-green" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-left">
          <span className="font-bold text-ink">{who}</span>
          <span className="text-ink-2">
            {' '}
            · {sex} · {years(draft.age!)}
            {pregnancy && ` · ${pregnancy}`}
          </span>
        </span>
        <span className="shrink-0 font-bold text-green">Zmień</span>
      </button>
    )
  }

  return (
    <div
      ref={card}
      className={`person cut ${invalid ? 'is-invalid' : ''}`}
      // Folds into one line once it's filled in and the person moves on (taps the body, the search…).
      onBlur={(e) => {
        if (complete && !card.current?.contains(e.relatedTarget as Node | null)) setEditing(false)
      }}
    >
      <div>
        <p className="eyebrow mb-1.5">Dla kogo</p>
        <Segmented<ForWhom>
          label="Dla kogo jest ta ocena"
          size="sm"
          full
          value={draft.forWhom}
          onChange={(forWhom) => changed({ forWhom })}
          options={[
            { value: 'me', label: 'Dla mnie' },
            { value: 'other', label: 'Dla kogoś innego' },
          ]}
        />
      </div>
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1.5">Płeć</p>
          <Segmented<Sex>
            label="Płeć"
            size="sm"
            full
            value={draft.sex}
            invalid={invalid && !draft.sex}
            onChange={(sex) => changed({ sex })}
            options={[
              { value: 'f', label: 'Kobieta' },
              { value: 'm', label: 'Mężczyzna' },
            ]}
          />
        </div>
        <div className="shrink-0">
          <label htmlFor="age" className="eyebrow mb-1.5 block">
            Wiek
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id="age"
              type="number"
              inputMode="numeric"
              enterKeyHint="done"
              min={0}
              max={120}
              value={draft.age ?? ''}
              onChange={(e) => changed({ age: e.target.value === '' ? undefined : Math.max(0, Math.min(120, Number(e.target.value))) })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
              aria-invalid={invalid && draft.age === undefined}
              className="field h-10 w-16 px-2 text-center text-base"
            />
            <span className="text-[0.9375rem] text-ink-2">lat</span>
          </div>
        </div>
      </div>
      {canBePregnant(draft) && (
        <div>
          <p className="eyebrow mb-1.5">Ciąża</p>
          <Segmented<Pregnancy>
            label={draft.forWhom === 'me' ? 'Czy jesteś w ciąży?' : 'Czy ta osoba jest w ciąży?'}
            size="sm"
            full
            value={draft.pregnancy}
            onChange={(pregnancy) => changed({ pregnancy })}
            options={[
              { value: 'no', label: 'Nie' },
              { value: 'yes', label: 'Tak' },
              { value: 'unknown', label: 'Nie wiem' },
            ]}
          />
        </div>
      )}
      {draft.age !== undefined && draft.age < 18 && <p className="text-sm text-care-urgent">Narzędzie jest przygotowane dla dorosłych; u dzieci i młodzieży objawy zawsze powinien ocenić lekarz.</p>}
    </div>
  )
}

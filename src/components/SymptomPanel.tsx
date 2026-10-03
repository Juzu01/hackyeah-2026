import { useMemo, useState } from 'react'
import { regionLabel, type Region } from '../body/regions.ts'
import { SKIN_SYMPTOMS, SUBAREAS } from '../data/subareas.ts'
import { SYMPTOM_BY_ID, symptomsForRegion } from '../data/symptoms.ts'
import type { Sex, Symptom } from '../data/types.ts'

export type PanelTarget = { kind: 'region'; region: Region } | { kind: 'general' } | { kind: 'skin' }

interface Props {
  target: PanelTarget
  sex?: Sex
  picked: ReadonlySet<string>
  onToggle: (symptomId: string, regionId?: string) => void
  onClose: () => void
}

const fold = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace('ł', 'l')

function Row({ s, checked, onChange }: { s: Symptom; checked: boolean; onChange: () => void }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-start gap-3 px-2 py-2.5 transition-colors ${checked ? 'bg-green-soft' : 'hover:bg-s2'}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="check mt-0.5" />
      <span className="text-base leading-snug text-ink">{s.name}</span>
    </label>
  )
}

/**
 * The list of symptoms for one place on the body (or the "general" / "skin"
 * groups that no region owns). Short, curated lists per region are what WebMD,
 * Healthwise and Symptomate all do, instead of showing the whole catalogue.
 */
export default function SymptomPanel({ target, sex, picked, onToggle, onClose }: Props) {
  const [sub, setSub] = useState<string>('all')
  const [filter, setFilter] = useState('')

  const title = target.kind === 'region' ? regionLabel(target.region) : target.kind === 'general' ? 'Objawy ogólne' : 'Skóra'
  const regionId = target.kind === 'region' ? target.region.id : undefined
  const defId = target.kind === 'region' ? target.region.defId : undefined
  const subareas = defId ? SUBAREAS[defId] : undefined

  const { specific, general } = useMemo(() => {
    if (target.kind === 'region') return symptomsForRegion(target.region.defId, sex)
    if (target.kind === 'general') return { specific: symptomsForRegion('__none__', sex).general, general: [] as Symptom[] }
    return { specific: SKIN_SYMPTOMS.map((id) => SYMPTOM_BY_ID.get(id)!).filter((s) => !s.sex || !sex || s.sex === sex), general: [] as Symptom[] }
  }, [target, sex])

  const q = fold(filter.trim())
  const visible = specific.filter((s) => {
    if (subareas && sub !== 'all' && !subareas.find((a) => a.id === sub)?.symptoms.includes(s.id)) return false
    return !q || fold(s.name).includes(q)
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="font-serif text-[1.375rem] leading-tight font-medium text-ink">{title}</h2>
          <p className="mt-0.5 text-[0.9375rem] text-ink-2">Zaznacz wszystko, co pasuje.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Zamknij listę" className="-mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center text-ink-2 hover:bg-s2 hover:text-ink">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {subareas && (
          <div className="mb-2 flex flex-wrap gap-1.5 px-2" role="tablist" aria-label="Okolica">
            {[{ id: 'all', label: 'Wszystko' }, ...subareas].map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={sub === a.id}
                onClick={() => setSub(a.id)}
                className="chip"
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        {specific.length > 10 && (
          <div className="px-2 pb-2">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtruj listę…"
              aria-label="Filtruj listę objawów"
              className="field w-full px-3 py-2 text-base"
            />
          </div>
        )}
        {visible.length === 0 && <p className="px-2 py-3 text-base text-ink-2">Brak objawów pasujących do filtra.</p>}
        <div>
          {visible.map((s) => (
            <Row key={s.id} s={s} checked={picked.has(s.id)} onChange={() => onToggle(s.id, regionId)} />
          ))}
        </div>
        {general.length > 0 && (
          <details className="mt-2 border-t border-line px-2 pt-2">
            <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold text-ink-2 hover:text-ink">Objawy ogólne (gorączka, osłabienie, nudności…)</summary>
            <div className="pb-1">
              {general.map((s) => (
                <Row key={s.id} s={s} checked={picked.has(s.id)} onChange={() => onToggle(s.id)} />
              ))}
            </div>
          </details>
        )}
      </div>
      <p className="shrink-0 border-t border-line px-4 py-2.5 text-sm text-ink-2">Nie ma Twojego objawu? Użyj wyszukiwarki – przeszukuje wszystkie okolice ciała.</p>
    </div>
  )
}

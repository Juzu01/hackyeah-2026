import { useEffect, useMemo, useRef, useState } from 'react'
import { regionLabel, type Region } from '../body/regions.ts'
import BodyMap from '../components/BodyMap.tsx'
import EmergencyBar from '../components/EmergencyBar.tsx'
import PersonCard from '../components/PersonCard.tsx'
import Steps from '../components/Steps.tsx'
import SymptomPanel, { type PanelTarget } from '../components/SymptomPanel.tsx'
import SymptomSearch from '../components/SymptomSearch.tsx'
import { symptomName } from '../data/symptoms.ts'
import { PERIOD, type CheckDraft } from '../lib/check.ts'
import { loadProfile, saveProfile } from '../lib/history.ts'
import { useMediaQuery } from '../lib/useMediaQuery.ts'

interface Props {
  draft: CheckDraft
  update: (patch: Partial<CheckDraft>) => void
  togglePick: (symptomId: string, regionId?: string) => void
  userId?: string
  onNext: () => void
}

const CONSENT_KEY = 'gdzieboli:consent'

/**
 * Step 1 of 3, where it hurts. The page title lives in the bar above, so this screen opens
 * straight on the steps, the emergency line and who it's for (one line once known); then the
 * search and the body, standing in its light on Doco's horizon. What's picked collects in a
 * tray at the bottom with "Dalej", always in reach of a thumb. The body shows its front only:
 * the back (back, nape, buttocks, calves, heels) is found by search.
 */
export default function StartScreen({ draft, update, togglePick, userId, onNext }: Props) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [target, setTarget] = useState<PanelTarget | null>(null)
  const [hover, setHover] = useState<Region | null>(null)
  const [consent, setConsent] = useState(() => {
    try {
      return localStorage.getItem(CONSENT_KEY) === '1'
    } catch {
      return false
    }
  })
  const [error, setError] = useState<string | null>(null)
  const person = useRef<HTMLDivElement>(null)

  const picked = useMemo(() => new Set(draft.picks.map((p) => p.symptomId)), [draft.picks])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of draft.picks) if (p.regionId) m.set(p.regionId, (m.get(p.regionId) ?? 0) + 1)
    return m
  }, [draft.picks])

  // "Dla mnie": remember sex and age between checks.
  useEffect(() => {
    if (draft.forWhom !== 'me' || draft.sex !== undefined || draft.age !== undefined) return
    const p = loadProfile(userId)
    if (p.sex || p.age !== undefined) update({ sex: p.sex, age: p.age })
  }, [draft.forWhom, draft.sex, draft.age, userId, update])

  const selectRegion = (r: Region) => {
    setTarget({ kind: 'region', region: r })
    setError(null)
  }
  const closePanel = () => setTarget(null)

  const next = () => {
    if (!draft.sex || draft.age === undefined || Number.isNaN(draft.age)) {
      setError('Podaj płeć i wiek – wpływają na listę objawów i możliwe przyczyny.')
      person.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (draft.picks.length === 0) {
      setError('Wskaż przynajmniej jeden objaw: stuknij miejsce na ciele albo wpisz objaw w wyszukiwarce.')
      return
    }
    if (!consent) {
      setError('Zaznacz, że rozumiesz, czym jest wynik.')
      return
    }
    if (draft.forWhom === 'me') saveProfile(userId, { sex: draft.sex, age: draft.age })
    onNext()
  }

  const setConsentPersist = (v: boolean) => {
    setConsent(v)
    if (v) setError(null)
    try {
      localStorage.setItem(CONSENT_KEY, v ? '1' : '0')
    } catch {
      // ignore
    }
  }

  const invalidPerson = !!error && (!draft.sex || draft.age === undefined)
  const panel = target && <SymptomPanel target={target} sex={draft.sex} picked={picked} onToggle={togglePick} onClose={closePanel} />
  const n = draft.picks.length
  const place = hover ? regionLabel(hover) : target?.kind === 'region' ? regionLabel(target.region) : null

  const tray = (
    <div className="tray lg:col-span-7 lg:col-start-6 lg:row-start-4" aria-live="polite">
      {error && (
        <p role="alert" className="mb-2 text-[0.9375rem] font-semibold text-alarm">
          {error}
        </p>
      )}
      {n === 0 ? (
        <p className="tray-hint">
          <span className="tray-dot" aria-hidden="true" />
          Stuknij miejsce na ciele, które boli, albo wpisz objaw.
        </p>
      ) : (
        <>
          <ul className="tray-chips" aria-label={`Twoje objawy (${n})`}>
            {draft.picks.map((p) => (
              <li key={p.symptomId}>
                <button type="button" onClick={() => togglePick(p.symptomId)} className="tray-chip" aria-label={`Usuń objaw: ${symptomName(p.symptomId)}`}>
                  <span className="truncate">{symptomName(p.symptomId)}</span>
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="square">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <div className="tray-row">
            <label className="tray-consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsentPersist(e.target.checked)} className="check" />
              <span>Rozumiem: to wstępna ocena, nie diagnoza.</span>
            </label>
            <button type="button" onClick={next} className="btn-primary shrink-0 px-6">
              Dalej
              <span className="tray-count">{n}</span>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl px-4 pt-3 lg:pt-6">
      <Steps current={1} />

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-x-6">
        <div className="space-y-3 lg:col-span-12">
          <EmergencyBar />
          <div ref={person}>
            <PersonCard draft={draft} update={update} invalid={invalidPerson} onEdit={() => setError(null)} />
          </div>
        </div>

        {/* Search: above the body on phones, top of the right column on desktop. */}
        <div className="lg:col-span-7 lg:col-start-6 lg:row-start-2">
          <SymptomSearch sex={draft.sex} picked={picked} onPick={(s) => togglePick(s.id, target?.kind === 'region' && s.regions.includes(target.region.defId) ? target.region.id : undefined)} />
        </div>

        {/* The body. */}
        <section className="stage cut lg:col-span-5 lg:col-start-1 lg:row-span-3 lg:row-start-2" aria-label="Sylwetka">
          <div className="stage-top">
            <p className={`stage-place ${place ? 'is-named' : ''}`} aria-live="polite">
              {place ?? 'Stuknij miejsce'}
            </p>
          </div>
          <BodyMap view="front" active={target?.kind === 'region' ? target.region.id : undefined} counts={counts} onSelect={selectRegion} onHover={setHover} className="stage-figure" />
          <div className="stage-more">
            <button type="button" onClick={() => setTarget({ kind: 'general' })} aria-pressed={target?.kind === 'general'} className="chip">
              Całe ciało
              <span className="chip-sub">gorączka, osłabienie</span>
            </button>
            <button type="button" onClick={() => setTarget({ kind: 'skin' })} aria-pressed={target?.kind === 'skin'} className="chip">
              Skóra
            </button>
            {/* The period has no place on the body: one tap adds it, and the questions come later. */}
            {draft.sex === 'f' && (
              <button type="button" onClick={() => togglePick(PERIOD)} aria-pressed={picked.has(PERIOD)} className="chip">
                Miesiączka
              </button>
            )}
          </div>
          <p className="stage-back">Ból pleców, karku albo pośladków? Wpisz go w wyszukiwarce.</p>
        </section>

        {/* Desktop: the list for the chosen place sits next to the body, the tray under it. */}
        {isDesktop && (
          <div className="lg:col-span-7 lg:col-start-6 lg:row-start-3">
            {target ? (
              <div className="cut flex max-h-[560px] flex-col overflow-hidden border border-green/35 bg-s1">{panel}</div>
            ) : (
              <p className="stage-empty">Wybierz miejsce na sylwetce – tu pojawi się krótka lista objawów dla tej okolicy. Możesz zaznaczyć objawy w kilku miejscach.</p>
            )}
          </div>
        )}
        {tray}
      </div>

      {/* Phones: the list for the chosen place slides up as a sheet. */}
      {!isDesktop && target && (
        <div className="fixed inset-0 z-40 flex items-end" role="dialog" aria-modal="true" aria-label="Lista objawów">
          <button type="button" aria-label="Zamknij" className="sheet-scrim absolute inset-0" onClick={closePanel} />
          <div className="sheet">
            <div className="sheet-grip" aria-hidden="true" />
            {panel}
            <div className="sheet-foot">
              <button type="button" onClick={closePanel} className="btn-primary w-full">
                Gotowe{n > 0 ? ` · ${n} ${n === 1 ? 'objaw' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'objawy' : 'objawów'}` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

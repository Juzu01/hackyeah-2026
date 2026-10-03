import { useEffect, useMemo, useRef, useState } from 'react'
import { buildRegions, regionLabel, type Region, type View } from '../body/regions.ts'
import BodyMap from '../components/BodyMap.tsx'
import EmergencyBar from '../components/EmergencyBar.tsx'
import Segmented from '../components/Segmented.tsx'
import SymptomPanel, { type PanelTarget } from '../components/SymptomPanel.tsx'
import SymptomSearch from '../components/SymptomSearch.tsx'
import { symptomName } from '../data/symptoms.ts'
import type { Sex } from '../data/types.ts'
import type { CheckDraft, ForWhom } from '../lib/check.ts'
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
 * Screen 1 is the checker itself: the body map is visible immediately, the
 * who/sex/age pre-step sits above it (WebMD), search is always one tap away
 * (the 2018 WebMD redesign lesson), chosen symptoms collect as chips.
 */
export default function StartScreen({ draft, update, togglePick, userId, onNext }: Props) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [view, setView] = useState<View>('front')
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
  const preStep = useRef<HTMLDivElement>(null)

  const picked = useMemo(() => new Set(draft.picks.map((p) => p.symptomId)), [draft.picks])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of draft.picks) if (p.regionId) m.set(p.regionId, (m.get(p.regionId) ?? 0) + 1)
    return m
  }, [draft.picks])
  const regionsOfView = useMemo(() => buildRegions(view), [view])

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
      preStep.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (draft.picks.length === 0) {
      setError('Wskaż przynajmniej jeden objaw: kliknij miejsce na sylwetce albo wpisz objaw w wyszukiwarce.')
      return
    }
    if (!consent) {
      setError('Potwierdź, że rozumiesz, czym jest wynik.')
      return
    }
    if (draft.forWhom === 'me') saveProfile(userId, { sex: draft.sex, age: draft.age })
    onNext()
  }

  const setConsentPersist = (v: boolean) => {
    setConsent(v)
    try {
      localStorage.setItem(CONSENT_KEY, v ? '1' : '0')
    } catch {
      // ignore
    }
  }

  const invalidPerson = !!error && (!draft.sex || draft.age === undefined)
  const panel = target && <SymptomPanel target={target} sex={draft.sex} picked={picked} onToggle={togglePick} onClose={closePanel} />

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 lg:pb-8">
      <div className="pt-4 pb-3 sm:pt-6 sm:pb-4 lg:pt-8">
        <h1 className="font-serif text-[2.125rem] leading-[1.1] font-medium tracking-tight text-ink sm:text-5xl">{draft.forWhom === 'me' ? 'Gdzie Cię boli?' : 'Gdzie boli tę osobę?'}</h1>
        <p className="mt-2 max-w-2xl text-base text-ink-2">
          <span className="sm:hidden">Wskaż miejsce na sylwetce albo wpisz objaw – wstępna ocena w ok. 3 minuty.</span>
          <span className="hidden sm:inline">Wskaż miejsce na sylwetce albo wpisz objaw. Potem kilka pytań i dostaniesz wstępną ocenę: co to może być i gdzie szukać pomocy. Zajmie to około 3 minuty.</span>
        </p>
      </div>

      <div className="mb-4">
        <EmergencyBar />
      </div>

      {/* Pre-step: who, sex, age. Inline, so the body stays on screen 1. */}
      <div ref={preStep} className={`cut mb-5 flex flex-wrap items-end gap-x-5 gap-y-3.5 border bg-s1 px-4 py-3.5 ${invalidPerson ? 'border-alarm-line' : 'border-line'}`}>
        <div>
          <p className="eyebrow mb-1.5">Dla kogo</p>
          <Segmented<ForWhom>
            label="Dla kogo jest ta ocena"
            size="sm"
            value={draft.forWhom}
            onChange={(forWhom) => update({ forWhom })}
            options={[
              { value: 'me', label: 'Dla mnie' },
              { value: 'other', label: 'Dla kogoś innego' },
            ]}
          />
        </div>
        <div>
          <p className="eyebrow mb-1.5">Płeć</p>
          <Segmented<Sex>
            label="Płeć"
            size="sm"
            value={draft.sex}
            invalid={invalidPerson && !draft.sex}
            onChange={(sex) => {
              update({ sex })
              setError(null)
            }}
            options={[
              { value: 'f', label: 'Kobieta' },
              { value: 'm', label: 'Mężczyzna' },
            ]}
          />
        </div>
        <div>
          <label htmlFor="age" className="eyebrow mb-1.5 block">
            Wiek
          </label>
          <div className="flex items-center gap-2">
            <input
              id="age"
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              value={draft.age ?? ''}
              onChange={(e) => {
                update({ age: e.target.value === '' ? undefined : Math.max(0, Math.min(120, Number(e.target.value))) })
                setError(null)
              }}
              aria-invalid={invalidPerson && draft.age === undefined}
              className="field h-10 w-[4.5rem] px-2 text-center text-base"
            />
            <span className="text-base text-ink-2">lat</span>
          </div>
        </div>
        {draft.age !== undefined && draft.age < 18 && <p className="basis-full text-sm text-care-urgent">Narzędzie jest przygotowane dla dorosłych; u dzieci i młodzieży objawy zawsze powinien ocenić lekarz.</p>}
      </div>

      <div className="grid gap-5 lg:grid-cols-12 lg:grid-rows-[auto_1fr_auto]">
        {/* Search: above the map on phones, top of the right column on desktop. */}
        <div className="lg:col-span-7 lg:col-start-6 lg:row-start-1">
          <SymptomSearch sex={draft.sex} picked={picked} onPick={(s) => togglePick(s.id, target?.kind === 'region' && s.regions.includes(target.region.defId) ? target.region.id : undefined)} />
        </div>

        {/* The body. */}
        <div className="cut border border-line bg-s1 p-3 lg:col-span-5 lg:col-start-1 lg:row-span-3 lg:row-start-1">
          <div className="flex items-center justify-between gap-2">
            <Segmented<View>
              label="Widok"
              size="sm"
              value={view}
              onChange={(v) => {
                setView(v)
                if (target?.kind === 'region') setTarget(null)
              }}
              options={[
                { value: 'front', label: 'Przód' },
                { value: 'back', label: 'Tył' },
              ]}
            />
            <p className="min-h-5 truncate text-right text-[0.9375rem] text-ink-2" aria-live="polite">
              {hover ? regionLabel(hover) : target?.kind === 'region' ? regionLabel(target.region) : 'Kliknij miejsce, które boli'}
            </p>
          </div>
          <BodyMap
            view={view}
            active={target?.kind === 'region' ? target.region.id : undefined}
            counts={counts}
            onSelect={selectRegion}
            onHover={setHover}
            className="mx-auto mt-2 h-[58vh] max-h-[560px] w-auto max-w-full"
          />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={() => setTarget({ kind: 'general' })} aria-pressed={target?.kind === 'general'} className="chip">
              Objawy ogólne
            </button>
            <button type="button" onClick={() => setTarget({ kind: 'skin' })} aria-pressed={target?.kind === 'skin'} className="chip">
              Skóra
            </button>
            <label className="sr-only" htmlFor="region-select">
              Wybierz okolicę z listy
            </label>
            <select
              id="region-select"
              value={target?.kind === 'region' ? target.region.id : ''}
              onChange={(e) => {
                const r = regionsOfView.find((x) => x.id === e.target.value)
                if (r) selectRegion(r)
              }}
              className="field h-10 px-2.5 text-[0.9375rem]"
            >
              <option value="">Wybierz z listy…</option>
              {regionsOfView.map((r) => (
                <option key={r.id} value={r.id}>
                  {regionLabel(r)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Symptom list for the chosen place (inline on desktop, bottom sheet on phones). */}
        <div className="lg:col-span-7 lg:col-start-6 lg:row-start-2">
          {isDesktop && target ? (
            <div className="cut flex max-h-[560px] flex-col overflow-hidden border border-green/35 bg-s1">{panel}</div>
          ) : (
            <div className="border border-line px-4 py-4 text-base text-ink-2">
              <p className="eyebrow">Jak to działa</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 marker:text-green">
                <li>Kliknij miejsce na sylwetce – pokaże się krótka lista objawów dla tej okolicy.</li>
                <li>Zaznacz wszystko, co pasuje; możesz wskazać kilka miejsc.</li>
                <li>Objawy bez konkretnego miejsca (gorączka, osłabienie, wysypka) znajdziesz pod sylwetką albo w wyszukiwarce.</li>
              </ol>
            </div>
          )}

          <div className="cut mt-4 border border-line bg-s1 px-4 py-3.5">
            <p className="eyebrow">Twoje objawy ({draft.picks.length})</p>
            {draft.picks.length === 0 ? (
              <p className="mt-1.5 text-base text-ink-2">Nie wybrano jeszcze objawów.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {draft.picks.map((p) => (
                  <li key={p.symptomId}>
                    <button
                      type="button"
                      onClick={() => togglePick(p.symptomId)}
                      className="group inline-flex min-h-10 items-center gap-2 border border-green/40 bg-green-soft py-1 pr-2 pl-3 text-[0.9375rem] text-ink hover:border-green"
                      aria-label={`Usuń objaw: ${symptomName(p.symptomId)}`}
                    >
                      {symptomName(p.symptomId)}
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-green" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="square">
                        <path d="M6 6l12 12M18 6 6 18" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Next: sticky on phones so it is reachable while scrolling the body. */}
        <div className="sticky bottom-0 z-20 -mx-4 border-t border-line-2 bg-page px-4 py-3 lg:static lg:col-span-7 lg:col-start-6 lg:row-start-3 lg:mx-0 lg:border lg:border-line lg:bg-s1">
          {error && (
            <p role="alert" className="mb-2 text-base font-medium text-alarm">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-start gap-2.5 text-[0.9375rem] leading-snug text-ink-2">
              <input type="checkbox" checked={consent} onChange={(e) => setConsentPersist(e.target.checked)} className="check mt-0.5" />
              <span>Rozumiem, że wynik to wstępna ocena na podstawie moich odpowiedzi, a nie diagnoza.</span>
            </label>
            <button
              type="button"
              onClick={next}
              className="btn-primary px-7"
            >
              Dalej{draft.picks.length > 0 ? ` (${draft.picks.length})` : ''}
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom sheet on phones. */}
      {!isDesktop && target && (
        <div className="fixed inset-0 z-40 flex items-end" role="dialog" aria-modal="true" aria-label="Lista objawów">
          <button type="button" aria-label="Zamknij" className="absolute inset-0 bg-black/70" onClick={closePanel} />
          <div className="cut flex max-h-[78vh] w-full flex-col overflow-hidden border-t border-line-2 bg-s1">
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 bg-line-2" aria-hidden="true" />
            {panel}
            <div className="shrink-0 border-t border-line px-4 py-3">
              <button type="button" onClick={closePanel} className="btn-primary w-full">
                Gotowe{draft.picks.length > 0 ? ` (${draft.picks.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

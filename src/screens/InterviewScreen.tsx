import { useMemo, useState, type ReactNode } from 'react'
import Steps from '../components/Steps.tsx'
import { symptomName } from '../data/symptoms.ts'
import type { CycleCourse, CycleFlow, CycleShift, CycleTiming, Duration, Onset, RedFlag, SymptomCourse, Trend } from '../data/types.ts'
import { PRIVACY_NOTE } from '../lib/analysis.ts'
import { interviewRedFlags, PERIOD, pickedSymptoms, type Answer, type CheckDraft } from '../lib/check.ts'

interface Props {
  draft: CheckDraft
  update: (patch: Partial<CheckDraft>) => void
  onBack: () => void
  onDone: () => void
}

type Step = { kind: 'flag'; flag: RedFlag } | { kind: 'course'; symptomId: string }

const DURATIONS: [Duration, string][] = [
  ['hours', 'Krócej niż dzień'],
  ['days', 'Od kilku dni'],
  ['weeks', 'Od 1 do 4 tygodni'],
  ['months', 'Ponad miesiąc'],
]
const ONSETS: [Onset, string][] = [
  ['sudden', 'Nagle, w ciągu minut lub godzin'],
  ['gradual', 'Stopniowo, narastało przez dni'],
]
const TRENDS: [Trend, string][] = [
  ['worse', 'Nasila się'],
  ['same', 'Bez zmian'],
  ['better', 'Słabnie'],
]

/** The pain scale's three zones: 1–3 mild (green), 4–7 moderate (yellow), 8–10 severe (red). */
const zoneOf = (v: number) => (v <= 3 ? 'low' : v <= 7 ? 'mid' : 'high')

function Tile({ selected, onClick, children, tone = 'default', compact = false }: { selected?: boolean; onClick: () => void; children: ReactNode; tone?: 'default' | 'yes'; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border px-4 text-left text-base font-medium transition-colors ${compact ? 'min-h-12 py-2.5' : 'min-h-14 py-3.5 sm:text-lg'} ${
        selected ? 'border-green bg-green-soft text-ink' : tone === 'yes' ? 'border-line-2 bg-s2 text-ink hover:border-alarm-line hover:bg-alarm-soft' : 'border-line-2 bg-s2 text-ink hover:border-green/60'
      }`}
    >
      {children}
    </button>
  )
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="mt-6 first-of-type:mt-5">
      <legend className="text-lg font-semibold text-ink">{title}</legend>
      {hint && <p className="mt-1 text-[0.9375rem] text-ink-2">{hint}</p>}
      <div className="mt-3">{children}</div>
    </fieldset>
  )
}

/**
 * Alarm questions first, one per screen with big tiles (Symptomate, Ada, NHS 111) and an
 * immediate emergency interrupt on "yes"; they are about the person, so they are asked once.
 * Then one screen per symptom: how bad, since when, how it started and how it is changing.
 */
export default function InterviewScreen({ draft, update, onBack, onDone }: Props) {
  const flags = useMemo(() => interviewRedFlags(draft), [draft])
  const symptoms = useMemo(() => pickedSymptoms(draft), [draft])
  const steps = useMemo<Step[]>(
    () => [...flags.map((flag): Step => ({ kind: 'flag', flag })), ...symptoms.map((symptomId): Step => ({ kind: 'course', symptomId }))],
    [flags, symptoms],
  )
  const [i, setI] = useState(0)
  const [interrupt, setInterrupt] = useState<RedFlag | null>(null)
  const [why, setWhy] = useState(false)

  const step = steps[Math.min(i, steps.length - 1)]
  const next = () => {
    setWhy(false)
    window.scrollTo({ top: 0 })
    if (i + 1 < steps.length) setI(i + 1)
    else onDone()
  }
  const back = () => {
    setWhy(false)
    if (interrupt) setInterrupt(null)
    else if (i > 0) setI(i - 1)
    else onBack()
  }
  const answerFlag = (flag: RedFlag, a: Answer) => {
    update({ answers: { ...draft.answers, [flag.id]: a } })
    if (a === 'yes' && flag.triage === 'emergency') setInterrupt(flag)
    else next()
  }

  if (interrupt) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <section className="cut overflow-hidden border border-alarm-line bg-s1" aria-live="assertive">
          <div className="border-b border-alarm-line bg-alarm-soft px-5 py-4">
            <p className="eyebrow text-alarm">Stan nagły</p>
            <h1 className="mt-1 font-serif text-[1.75rem] leading-tight font-medium text-ink">
              Wezwij pomoc teraz: <span className="text-alarm">112</span> lub <span className="text-alarm">999</span>
            </h1>
          </div>
          <div className="space-y-4 px-5 py-4 text-base text-ink">
            <p>
              Odpowiedź „tak” na to pytanie oznacza możliwe zagrożenie życia ({interrupt.reason}). Nie czekaj na resztę pytań ani na wynik.
            </p>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <a href="tel:112" className="btn-primary is-alarm text-lg">
                Zadzwoń: 112
              </a>
              <a href="tel:999" className="btn-primary is-alarm text-lg">
                Pogotowie: 999
              </a>
            </div>
            <p className="text-ink-2">Jeśli to pomyłka, możesz wrócić i zmienić odpowiedź.</p>
            <div className="grid gap-2 pt-1 sm:flex sm:flex-wrap">
              <button type="button" onClick={back} className="btn-secondary">
                Wróć do pytania
              </button>
              <button type="button" onClick={onDone} className="btn-secondary">
                Pokaż wynik mimo to
              </button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3 pb-6 sm:pb-8 lg:pt-6">
      <Steps current={2} progress={(i + 1) / steps.length} />
      <div className="mt-3 mb-4">
        <div className="flex items-center justify-between text-[0.9375rem] text-ink-2">
          <button type="button" onClick={back} className="-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 font-medium text-ink hover:bg-s2">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5m6 6-6-6 6-6" />
            </svg>
            Wstecz
          </button>
          <span>
            Krok {i + 1} z {steps.length}
          </span>
        </div>
      </div>

      <section className="cut border border-line bg-s1 p-5 sm:p-7" aria-live="polite">
        {step.kind === 'flag' && (
          <>
            <p className="eyebrow text-alarm">Objawy alarmowe</p>
            <h1 className="mt-1.5 font-serif text-[1.625rem] leading-tight font-medium text-ink sm:text-[2rem]">{step.flag.question}</h1>
            <button type="button" onClick={() => setWhy((w) => !w)} className="mt-2 inline-flex min-h-11 items-center text-base font-semibold text-green underline-offset-4 hover:underline" aria-expanded={why}>
              Dlaczego o to pytamy?
            </button>
            {why && (
              <p className="rounded-xl bg-s2 px-4 py-3 text-base text-ink-2">
                Najpierw wykluczamy objawy, które wymagają natychmiastowej pomocy ({step.flag.reason}). Odpowiedź „tak” zmienia zalecenie niezależnie od reszty wywiadu.
              </p>
            )}
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Tile tone="yes" selected={draft.answers[step.flag.id] === 'yes'} onClick={() => answerFlag(step.flag, 'yes')}>
                Tak
              </Tile>
              <Tile selected={draft.answers[step.flag.id] === 'no'} onClick={() => answerFlag(step.flag, 'no')}>
                Nie
              </Tile>
              <Tile selected={draft.answers[step.flag.id] === 'unknown'} onClick={() => answerFlag(step.flag, 'unknown')}>
                Nie wiem
              </Tile>
            </div>
          </>
        )}

        {step.kind === 'course' &&
          (() => {
            const props = {
              symptomId: step.symptomId,
              position: symptoms.length > 1 ? `Objaw ${symptoms.indexOf(step.symptomId) + 1} z ${symptoms.length}` : 'Przebieg',
              course: draft.courses?.[step.symptomId] ?? {},
              onChange: (course: SymptomCourse) => update({ courses: { ...draft.courses, [step.symptomId]: course } }),
              last: i + 1 >= steps.length,
              onNext: next,
            }
            return step.symptomId === PERIOD ? <CycleStep key={step.symptomId} {...props} /> : <CourseStep key={step.symptomId} {...props} />
          })()}
      </section>
      <p className="mt-4 text-center text-sm text-ink-2">{PRIVACY_NOTE}</p>
    </div>
  )
}

interface StepProps {
  symptomId: string
  position: string
  course: SymptomCourse
  onChange: (course: SymptomCourse) => void
  last: boolean
  onNext: () => void
}

function PainScale({ title, hint, value, onChange }: { title: string; hint: string; value?: number; onChange: (v: number) => void }) {
  return (
    <Question title={title} hint={hint}>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10" role="radiogroup" aria-label="Nasilenie od 1 do 10">
        {Array.from({ length: 10 }, (_, k) => k + 1).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} data-zone={zoneOf(v)} onClick={() => onChange(v)} className="level">
            {v}
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-sm text-ink-2">
        <span>Łagodne</span>
        <span>Umiarkowane</span>
        <span>Nie do zniesienia</span>
      </div>
    </Question>
  )
}

function StepHead({ symptomId, position }: { symptomId: string; position: string }) {
  return (
    <>
      <p className="eyebrow">{position}</p>
      <h1 className="mt-1.5 font-serif text-[1.625rem] leading-tight font-medium text-ink sm:text-[2rem]">{symptomName(symptomId)}</h1>
    </>
  )
}

function StepFoot({ done, missing, last, onNext }: { done: boolean; missing: string; last: boolean; onNext: () => void }) {
  return (
    <div className="mt-7 flex flex-wrap items-center justify-end gap-3">
      {!done && <p className="text-[0.9375rem] text-ink-2">{missing}</p>}
      <button type="button" onClick={onNext} disabled={!done} className="btn-primary px-7">
        {last ? 'Pokaż wynik' : 'Dalej'}
      </button>
    </div>
  )
}

function Tiles<T extends string>({ options, value, onPick, columns = 2 }: { options: [T, string][]; value?: T; onPick: (v: T) => void; columns?: 2 | 3 }) {
  return (
    <div className={`grid gap-2 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {options.map(([v, label]) => (
        <Tile key={v} compact selected={value === v} onClick={() => onPick(v)}>
          {label}
        </Tile>
      ))}
    </div>
  )
}

function CourseStep({ symptomId, position, course, onChange, last, onNext }: StepProps) {
  const set = (patch: SymptomCourse) => onChange({ ...course, ...patch })
  const done = course.severity !== undefined && !!course.duration && !!course.onset && !!course.trend
  return (
    <>
      <StepHead symptomId={symptomId} position={position} />
      <PainScale title="Jak bardzo to dokucza?" hint="1 to ledwo odczuwalne, 10 to najgorsze, jakie potrafisz sobie wyobrazić." value={course.severity} onChange={(severity) => set({ severity })} />
      <Question title="Od kiedy to trwa?">
        <Tiles options={DURATIONS} value={course.duration} onPick={(duration) => set({ duration })} />
      </Question>
      <Question title="Jak to się zaczęło?">
        <Tiles options={ONSETS} value={course.onset} onPick={(onset) => set({ onset })} />
      </Question>
      <Question title="Jak to się zmienia?">
        <Tiles options={TRENDS} value={course.trend} onPick={(trend) => set({ trend })} columns={3} />
      </Question>
      <StepFoot done={done} missing="Odpowiedz na wszystkie cztery pytania." last={last} onNext={onNext} />
    </>
  )
}

const TIMINGS: [CycleTiming, string][] = [
  ['late', 'Spóźnia się'],
  ['early', 'Przyszła wcześniej'],
  ['usual', 'W zwykłym terminie'],
  ['irregular', 'Cykl jest nieregularny'],
]
const LATE_BY: [CycleShift, string][] = [
  ['week', 'Do 7 dni'],
  ['two-weeks', '8–14 dni'],
  ['more', 'Ponad 2 tygodnie'],
]
const EARLY_BY: [CycleShift, string][] = [
  ['week', 'Do 7 dni'],
  ['more', 'Ponad tydzień'],
]
const FLOWS: [CycleFlow, string][] = [
  ['light', 'Skąpsza niż zwykle'],
  ['usual', 'Jak zwykle'],
  ['heavy', 'Obfitsza niż zwykle'],
  ['flooding', 'Bardzo obfita: podpaska lub tampon co godzinę'],
]
const YES_NO: ['yes' | 'no', string][] = [
  ['no', 'Nie'],
  ['yes', 'Tak'],
]

/**
 * The period: when it came against the usual cycle (and by how much), how heavy it is once it
 * has come, how much it hurts (if it does), and spotting between periods.
 */
function CycleStep({ symptomId, position, course, onChange, last, onNext }: StepProps) {
  const cycle: CycleCourse = course.cycle ?? {}
  const setCycle = (patch: CycleCourse) => onChange({ ...course, cycle: { ...cycle, ...patch } })
  const shifted = cycle.timing === 'late' || cycle.timing === 'early'
  // A late period hasn't come yet: nothing to say about how heavy it is.
  const flowAsked = !!cycle.timing && cycle.timing !== 'late'
  const done = !!cycle.timing && (!shifted || !!cycle.shift) && (!flowAsked || !!cycle.flow) && cycle.spotting !== undefined
  return (
    <>
      <StepHead symptomId={symptomId} position={position} />
      <Question title="Kiedy przyszła miesiączka?" hint="W porównaniu ze zwykłym cyklem.">
        <Tiles options={TIMINGS} value={cycle.timing} onPick={(timing) => setCycle({ timing, shift: timing === cycle.timing ? cycle.shift : undefined, flow: timing === 'late' ? undefined : cycle.flow })} />
      </Question>
      {shifted && (
        <Question title={cycle.timing === 'late' ? 'O ile się spóźnia?' : 'O ile wcześniej?'}>
          <Tiles options={cycle.timing === 'late' ? LATE_BY : EARLY_BY} value={cycle.shift} onPick={(shift) => setCycle({ shift })} columns={cycle.timing === 'late' ? 3 : 2} />
        </Question>
      )}
      {flowAsked && (
        <Question title="Jak obfita jest miesiączka?">
          <Tiles options={FLOWS} value={cycle.flow} onPick={(flow) => setCycle({ flow })} />
        </Question>
      )}
      <PainScale title="Jak bardzo boli?" hint="Jeśli nie boli, pomiń to pytanie." value={course.severity} onChange={(severity) => onChange({ ...course, severity })} />
      <Question title="Czy jest plamienie lub krwawienie między miesiączkami?">
        <Tiles options={YES_NO} value={cycle.spotting === undefined ? undefined : cycle.spotting ? 'yes' : 'no'} onPick={(v) => setCycle({ spotting: v === 'yes' })} />
      </Question>
      <StepFoot done={done} missing="Odpowiedz na pytania powyżej (ból możesz pominąć)." last={last} onNext={onNext} />
    </>
  )
}

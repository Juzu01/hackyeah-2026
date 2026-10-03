import { useMemo, useState, type ReactNode } from 'react'
import type { Duration, Onset, RedFlag, Trend } from '../data/types.ts'
import { interviewRedFlags, type Answer, type CheckDraft } from '../lib/check.ts'

interface Props {
  draft: CheckDraft
  update: (patch: Partial<CheckDraft>) => void
  onBack: () => void
  onDone: () => void
}

type Step = { kind: 'flag'; flag: RedFlag } | { kind: 'duration' } | { kind: 'onset' } | { kind: 'severity' } | { kind: 'trend' }

function Tile({ selected, onClick, children, tone = 'default' }: { selected?: boolean; onClick: () => void; children: ReactNode; tone?: 'default' | 'yes' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-2xl border-2 px-4 py-4 text-left text-base font-medium shadow-sm transition-colors sm:text-lg ${
        selected ? 'border-teal-700 bg-teal-50 text-teal-900' : tone === 'yes' ? 'border-slate-200 bg-white text-slate-800 hover:border-red-300 hover:bg-red-50' : 'border-slate-200 bg-white text-slate-800 hover:border-teal-400 hover:bg-teal-50'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * One question per screen with big tiles (Symptomate, Ada, NHS 111): alarm
 * questions first, with an immediate emergency interrupt on "yes", then
 * duration, onset, severity and trend.
 */
export default function InterviewScreen({ draft, update, onBack, onDone }: Props) {
  const flags = useMemo(() => interviewRedFlags(draft), [draft])
  const steps = useMemo<Step[]>(() => [...flags.map((flag): Step => ({ kind: 'flag', flag })), { kind: 'duration' }, { kind: 'onset' }, { kind: 'severity' }, { kind: 'trend' }], [flags])
  const [i, setI] = useState(0)
  const [interrupt, setInterrupt] = useState<RedFlag | null>(null)
  const [why, setWhy] = useState(false)

  const step = steps[Math.min(i, steps.length - 1)]
  const next = () => {
    setWhy(false)
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
        <section className="overflow-hidden rounded-2xl border-2 border-red-700 bg-red-50 shadow-sm" aria-live="assertive">
          <div className="bg-red-700 px-5 py-3 text-white">
            <p className="text-xs font-semibold tracking-wide uppercase opacity-90">Stan nagły</p>
            <h1 className="text-2xl font-bold">Wezwij pomoc teraz: 112 lub 999</h1>
          </div>
          <div className="space-y-4 px-5 py-4 text-slate-800">
            <p>
              Odpowiedź „tak” na to pytanie oznacza możliwe zagrożenie życia ({interrupt.reason}). Nie czekaj na resztę pytań ani na wynik.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href="tel:112" className="rounded-xl bg-slate-900 px-5 py-3 text-lg font-semibold text-white shadow hover:bg-slate-800">
                Zadzwoń: 112
              </a>
              <a href="tel:999" className="rounded-xl bg-slate-900 px-5 py-3 text-lg font-semibold text-white shadow hover:bg-slate-800">
                Pogotowie: 999
              </a>
            </div>
            <p className="text-sm text-slate-600">Jeśli to pomyłka, możesz wrócić i zmienić odpowiedź.</p>
            <div className="flex flex-wrap gap-3 pt-1 text-sm">
              <button type="button" onClick={back} className="rounded-full border border-slate-300 bg-white px-4 py-2 font-medium hover:bg-slate-50">
                Wróć do pytania
              </button>
              <button type="button" onClick={onDone} className="rounded-full border border-slate-300 bg-white px-4 py-2 font-medium hover:bg-slate-50">
                Pokaż wynik mimo to
              </button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  const progress = Math.round(((i + 1) / steps.length) * 100)

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <div className="mb-5">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <button type="button" onClick={back} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium hover:bg-slate-100">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5m6 6-6-6 6-6" />
            </svg>
            Wstecz
          </button>
          <span>
            Pytanie {i + 1} z {steps.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-live="polite">
        {step.kind === 'flag' && (
          <>
            <p className="text-xs font-semibold tracking-wide text-red-700 uppercase">Objawy alarmowe</p>
            <h1 className="mt-1 text-xl font-semibold leading-snug text-slate-900 sm:text-2xl">{step.flag.question}</h1>
            <button type="button" onClick={() => setWhy((w) => !w)} className="mt-2 text-sm font-medium text-teal-800 hover:underline" aria-expanded={why}>
              Dlaczego o to pytamy?
            </button>
            {why && (
              <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
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

        {step.kind === 'duration' && (
          <>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Przebieg</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">Od jak dawna trwają objawy?</h1>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['hours', 'Krócej niż dzień'],
                  ['days', 'Od kilku dni'],
                  ['weeks', 'Od 1 do 4 tygodni'],
                  ['months', 'Ponad miesiąc'],
                ] as [Duration, string][]
              ).map(([v, label]) => (
                <Tile
                  key={v}
                  selected={draft.duration === v}
                  onClick={() => {
                    update({ duration: v })
                    next()
                  }}
                >
                  {label}
                </Tile>
              ))}
            </div>
          </>
        )}

        {step.kind === 'onset' && (
          <>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Przebieg</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">Jak zaczęły się objawy?</h1>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['sudden', 'Nagle, w ciągu minut lub godzin'],
                  ['gradual', 'Stopniowo, narastały przez dni'],
                ] as [Onset, string][]
              ).map(([v, label]) => (
                <Tile
                  key={v}
                  selected={draft.onset === v}
                  onClick={() => {
                    update({ onset: v })
                    next()
                  }}
                >
                  {label}
                </Tile>
              ))}
            </div>
          </>
        )}

        {step.kind === 'severity' && (
          <>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Nasilenie</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">Jak silne są dolegliwości?</h1>
            <p className="mt-1 text-sm text-slate-600">1 to ledwo odczuwalne, 10 to najgorsze, jakie potrafisz sobie wyobrazić.</p>
            <div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-10" role="radiogroup" aria-label="Nasilenie od 1 do 10">
              {Array.from({ length: 10 }, (_, k) => k + 1).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={draft.severity === v}
                  onClick={() => {
                    update({ severity: v })
                    next()
                  }}
                  className={`aspect-square rounded-xl border-2 text-lg font-semibold ${
                    draft.severity === v ? 'border-teal-700 bg-teal-700 text-white' : v >= 8 ? 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50' : 'border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>Łagodne</span>
              <span>Umiarkowane</span>
              <span>Nie do zniesienia</span>
            </div>
          </>
        )}

        {step.kind === 'trend' && (
          <>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Przebieg</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">Jak zmieniają się objawy?</h1>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {(
                [
                  ['worse', 'Nasilają się'],
                  ['same', 'Bez zmian'],
                  ['better', 'Słabną'],
                ] as [Trend, string][]
              ).map(([v, label]) => (
                <Tile
                  key={v}
                  selected={draft.trend === v}
                  onClick={() => {
                    update({ trend: v })
                    next()
                  }}
                >
                  {label}
                </Tile>
              ))}
            </div>
          </>
        )}
      </section>
      <p className="mt-4 text-center text-xs text-slate-500">Twoje odpowiedzi zostają w tej przeglądarce i nie są nigdzie wysyłane.</p>
    </div>
  )
}

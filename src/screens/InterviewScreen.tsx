import { useMemo, useState, type ReactNode } from 'react'
import Steps from '../components/Steps.tsx'
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
      className={`min-h-14 rounded-xl border px-4 py-3.5 text-left text-base font-medium transition-colors sm:text-lg ${
        selected ? 'border-green bg-green-soft text-ink' : tone === 'yes' ? 'border-line-2 bg-s2 text-ink hover:border-alarm-line hover:bg-alarm-soft' : 'border-line-2 bg-s2 text-ink hover:border-green/60'
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
            Pytanie {i + 1} z {steps.length}
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

        {step.kind === 'duration' && (
          <>
            <p className="eyebrow">Przebieg</p>
            <h1 className="mt-1.5 font-serif text-[1.625rem] leading-tight font-medium text-ink sm:text-[2rem]">Od jak dawna trwają objawy?</h1>
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
            <p className="eyebrow">Przebieg</p>
            <h1 className="mt-1.5 font-serif text-[1.625rem] leading-tight font-medium text-ink sm:text-[2rem]">Jak zaczęły się objawy?</h1>
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
            <p className="eyebrow">Nasilenie</p>
            <h1 className="mt-1.5 font-serif text-[1.625rem] leading-tight font-medium text-ink sm:text-[2rem]">Jak silne są dolegliwości?</h1>
            <p className="mt-2 text-base text-ink-2">1 to ledwo odczuwalne, 10 to najgorsze, jakie potrafisz sobie wyobrazić.</p>
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
                  className={`aspect-square rounded-xl border text-lg font-semibold tabular-nums ${
                    draft.severity === v ? 'border-green bg-green font-bold text-green-ink' : v >= 8 ? 'border-line-2 bg-s2 text-ink hover:border-alarm-line hover:bg-alarm-soft' : 'border-line-2 bg-s2 text-ink hover:border-green/60'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-sm text-ink-2">
              <span>Łagodne</span>
              <span>Umiarkowane</span>
              <span>Nie do zniesienia</span>
            </div>
          </>
        )}

        {step.kind === 'trend' && (
          <>
            <p className="eyebrow">Przebieg</p>
            <h1 className="mt-1.5 font-serif text-[1.625rem] leading-tight font-medium text-ink sm:text-[2rem]">Jak zmieniają się objawy?</h1>
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
      <p className="mt-4 text-center text-sm text-ink-2">Twoje odpowiedzi zostają w tej przeglądarce i nie są nigdzie wysyłane.</p>
    </div>
  )
}

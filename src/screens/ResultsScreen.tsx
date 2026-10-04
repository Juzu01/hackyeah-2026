import { useEffect, useMemo, useState } from 'react'
import ConditionCard from '../components/ConditionCard.tsx'
import { DISCLAIMER } from '../components/Footer.tsx'
import Steps from '../components/Steps.tsx'
import TriageCard from '../components/TriageCard.tsx'
import { years } from '../components/PersonCard.tsx'
import { symptomName } from '../data/symptoms.ts'
import type { Triage } from '../data/types.ts'
import { useAccount } from '../lib/account.ts'
import { analyzeTogether, hasAiAnalysis, type Analysis } from '../lib/analysis.ts'
import { canBePregnant, courseSummary, interviewRedFlags, overallCourse, regionDefIds, regionsSummary, toInput, type CheckDraft } from '../lib/check.ts'
import { addToDiary, openDiary, docoShell } from '../lib/diary.ts'
import { analyze, analyzeBySymptom, TRIAGE_INFO } from '../lib/engine.ts'
import { saveCheck } from '../lib/history.ts'

interface Props {
  draft: CheckDraft
  /** Set when the result was opened from history. */
  savedAt?: string
  onRestart: () => void
  onToast: (message: string) => void
}

const SEX_LABEL = { f: 'kobieta', m: 'mężczyzna' } as const
const PREGNANCY_LABEL = { yes: 'w ciąży', unknown: 'możliwa ciąża', no: '' } as const

/** A symptom's own urgency, in the triage card's colours. */
const TONE: Record<Triage, string> = {
  'self-care': 'border-care-self/45 text-care-self',
  gp: 'border-care-gp/45 text-care-gp',
  urgent: 'border-care-urgent/45 text-care-urgent',
  emergency: 'border-care-emergency/45 text-care-emergency',
}

/** What the loading bar says while it fills; the AI's turn comes last when there is one. */
const STAGES = ['Łączę objawy…', 'Sprawdzam objawy alarmowe…', 'Dobieram możliwe przyczyny…', ...(hasAiAnalysis ? ['Analiza AI łączy wszystko w całość…'] : [])]
/** Long enough to read as "analysed", short enough not to make anyone wait. */
const MIN_WAIT = 1600

/**
 * Results in the order every product agrees on: the recommendation first, then what the
 * symptoms say together, then possible causes symptom by symptom (each folded to one line with
 * its own urgency and best match), then what to do next. A short "being analysed" bar comes first.
 */
export default function ResultsScreen({ draft, savedAt, onRestart, onToast }: Props) {
  const account = useAccount()
  const input = useMemo(() => toInput(draft), [draft])
  const result = useMemo(() => analyze(input), [input])
  const bySymptom = useMemo(() => analyzeBySymptom(input), [input])
  const where = regionsSummary(draft)
  const alarms = useMemo(() => interviewRedFlags(draft), [draft])
  const [saved, setSaved] = useState<boolean>(!!savedAt)
  const [askLogin, setAskLogin] = useState(false)
  const symptoms = [...new Set(draft.picks.map((p) => p.symptomId))].map(symptomName)
  const [date] = useState(() => new Date(savedAt ?? Date.now()))
  const forOther = draft.forWhom === 'other'

  // The reading of all symptoms together, behind a short loading bar (none for a saved result).
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [stage, setStage] = useState(0)
  useEffect(() => {
    let live = true
    const wait = new Promise((r) => setTimeout(r, savedAt ? 0 : MIN_WAIT))
    const ctx = { forWhom: draft.forWhom, sex: draft.sex, age: draft.age, pregnancy: input.pregnancy }
    Promise.all([analyzeTogether(ctx, input, result, bySymptom), wait]).then(([a]) => {
      if (live) setAnalysis(a)
    })
    return () => {
      live = false
    }
  }, [draft, input, result, bySymptom, savedAt])
  useEffect(() => {
    if (analysis) return
    const t = window.setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), MIN_WAIT / 3)
    return () => window.clearInterval(t)
  }, [analysis])

  // The PDF report shows every section, opened or not.
  useEffect(() => {
    const openAll = () => document.querySelectorAll('details').forEach((d) => (d.open = true))
    window.addEventListener('beforeprint', openAll)
    return () => window.removeEventListener('beforeprint', openAll)
  }, [])

  const save = () => {
    saveCheck(account.user?.id, {
      draft,
      triage: result.triage,
      topConditions: result.conditions.slice(0, 3).map((c) => c.condition.id),
      where: where || 'objawy ogólne',
    })
    setSaved(true)
    setAskLogin(false)
    onToast(account.user ? 'Zapisano w historii Twojego konta.' : 'Zapisano w historii na tym urządzeniu.')
  }
  const onSaveClick = () => {
    if (account.status === 'signed-out') setAskLogin(true)
    else save()
  }

  // The diary belongs to the Doco account: inside Doco the signed-in user may be known only there
  const [inDiary, setInDiary] = useState(false)
  const [diaryLogin, setDiaryLogin] = useState(false)
  const addEntry = () => {
    if (forOther) return
    const userId = account.user?.id ?? docoShell()?.Clerk?.user?.id
    if (!userId) {
      setDiaryLogin(true)
      const shell = docoShell()
      if (shell?.openAuth) shell.openAuth()
      else account.signIn()
      return
    }
    // The diary keeps one entry per check: the strongest, longest symptom speaks for all
    const course = overallCourse(draft)
    const ok = addToDiary(userId, {
      at: date.toISOString(),
      where: where || 'Objawy ogólne',
      regions: regionDefIds(draft),
      symptoms,
      level: course.severity,
      duration: course.duration,
      onset: course.onset,
      trend: course.trend,
      triage: result.triage,
      advice: TRIAGE_INFO[result.triage].short,
    })
    setDiaryLogin(false)
    setInDiary(ok)
    onToast(ok ? 'Dodano wpis do dziennika.' : 'Nie udało się zapisać wpisu na tym urządzeniu.')
  }

  const share = async () => {
    const text = [
      `Gdzie boli? – wstępna ocena objawów (${date.toLocaleDateString('pl-PL')})`,
      where ? `Gdzie: ${where}.` : '',
      `Zalecenie: ${TRIAGE_INFO[result.triage].short}.`,
      analysis ? `Objawy razem: ${analysis.summary}` : '',
      'Objawy:',
      ...bySymptom.map((s) => {
        const answers = courseSummary(s.course)
        const causes = s.conditions.length ? `możliwe przyczyny: ${s.conditions.map((c) => c.condition.name).join(', ')}` : 'bez wskazanej przyczyny'
        return `- ${symptomName(s.symptomId)}${answers ? ` (${answers})` : ''}: ${causes}.`
      }),
      'To wstępna ocena, nie diagnoza.',
    ]
      .filter(Boolean)
      .join('\n')
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Gdzie boli? – wstępna ocena', text })
      } else {
        await navigator.clipboard.writeText(text)
        onToast('Skopiowano podsumowanie do schowka.')
      }
    } catch {
      // cancelled
    }
  }

  if (!analysis) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-3 pb-6 sm:pb-8 lg:pt-6">
        <Steps current={3} />
        <section className="analyzing cut mt-5" aria-live="polite" aria-busy="true">
          <p className="eyebrow">Wstępna ocena</p>
          <h1 className="mt-1.5 font-serif text-[1.75rem] leading-tight font-medium text-ink">Twoje wyniki są analizowane</h1>
          <div className="analyzing-bar" aria-hidden="true">
            <span />
          </div>
          <p className="mt-3 text-base text-ink-2">{STAGES[stage]}</p>
        </section>
      </div>
    )
  }

  const pregnancy = canBePregnant(draft) && draft.pregnancy ? PREGNANCY_LABEL[draft.pregnancy] : ''
  return (
    <div className="mx-auto max-w-3xl px-4 pt-3 pb-6 sm:pb-8 lg:pt-6">
      <Steps current={3} />
      <div className="mt-5 mb-4">
        <p className="eyebrow">Wstępna ocena · {date.toLocaleDateString('pl-PL')}</p>
        <h1 className="mt-1.5 font-serif text-[2rem] leading-tight font-medium tracking-tight text-ink sm:text-[2.5rem]">{where || 'Objawy ogólne'}</h1>
        <p className="mt-2 text-base text-ink-2">
          {forOther ? 'Inna osoba' : 'Ty'} · {draft.sex ? SEX_LABEL[draft.sex] : '—'} · {draft.age !== undefined ? years(draft.age) : '—'}
          {pregnancy && ` · ${pregnancy}`}
        </p>
      </div>

      <TriageCard triage={result.triage} reasons={result.reasons} />

      {/* What the symptoms say together: the summary always, the details one tap away. */}
      <section className="insight cut mt-5" aria-labelledby="insight-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="insight-title" className="eyebrow">
            Twoje objawy razem
          </h2>
          {analysis.source === 'ai' && <span className="badge-ai">Analiza AI</span>}
        </div>
        <p className="mt-2 text-lg leading-snug font-semibold text-ink">{analysis.summary}</p>
        {analysis.points.length > 0 && (
          <div className="mt-3 divide-y divide-line border-y border-line">
            {analysis.points.map((p) => (
              <details key={p.title} className="fold">
                <summary>{p.title}</summary>
                <p className="pb-3 text-base text-ink-2">{p.text}</p>
              </details>
            ))}
          </div>
        )}
        <p className="mt-3 text-sm text-ink-2">{analysis.source === 'ai' ? 'AI połączyło Twoje odpowiedzi z naszą bazą chorób. To nie jest diagnoza.' : 'Na podstawie naszej bazy chorób i Twoich odpowiedzi. To nie jest diagnoza.'}</p>
      </section>

      <section className="mt-8" aria-labelledby="causes">
        <h2 id="causes" className="font-serif text-[1.75rem] leading-tight font-medium text-ink">
          Możliwe przyczyny
        </h2>
        <p className="mt-1 text-base text-ink-2">{bySymptom.length > 1 ? 'Dla każdego objawu osobno. Stuknij, żeby rozwinąć.' : 'Stuknij przyczynę, żeby zobaczyć dlaczego i co możesz zrobić.'}</p>
        <div className="mt-4 space-y-3">
          {bySymptom.map((s) => {
            const answers = courseSummary(s.course)
            const best = s.conditions[0]?.condition.name
            return (
              <details key={s.symptomId} className="symptom cut" open={bySymptom.length === 1}>
                <summary>
                  <span className="symptom-head">
                    <span className="symptom-name">{symptomName(s.symptomId)}</span>
                    <span className={`shrink-0 border px-2 py-0.5 text-[0.8125rem] font-semibold ${TONE[s.triage]}`}>{TRIAGE_INFO[s.triage].title}</span>
                  </span>
                  <span className="symptom-sub">{best ? `Najbardziej pasuje: ${best}` : 'Bez wskazanej przyczyny'}</span>
                </summary>
                <div className="symptom-body">
                  {answers && <p className="text-[0.9375rem] text-ink-2">{answers}</p>}
                  <p className="mt-1 text-[0.9375rem] text-ink-2">Dlaczego: {s.reasons.join(', ')}.</p>
                  {s.conditions.length === 0 ? (
                    <p className="mt-3 text-base text-ink-2">Za mało danych, żeby wskazać przyczyny tego objawu. Jeśli nie mija albo się nasila, skonsultuj się z lekarzem.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {s.conditions.map((item, idx) => (
                        <ConditionCard key={item.condition.id} item={item} rank={idx + 1} />
                      ))}
                    </div>
                  )}
                </div>
              </details>
            )
          })}
        </div>
      </section>

      {alarms.length > 0 && (
        <details className="alarms cut mt-6">
          <summary>Kiedy pilnie szukać pomocy</summary>
          <p className="mt-1 text-base text-ink">Jeśli pojawi się którykolwiek z tych objawów, nie czekaj – zadzwoń pod 112 lub 999 albo jedź na SOR.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-ink-2 marker:text-alarm">
            {alarms.map((f) => (
              <li key={f.id}>{f.question.replace(/\?$/, '')}</li>
            ))}
          </ul>
        </details>
      )}

      <section className="cut mt-8 border border-line bg-s1 p-4 sm:p-5 print:hidden" aria-labelledby="next">
        <h2 id="next" className="font-serif text-[1.375rem] leading-tight font-medium text-ink">
          Co dalej
        </h2>
        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
          {inDiary ? (
            <button type="button" onClick={openDiary} className="btn-primary">
              Zobacz dziennik
            </button>
          ) : (
            <button type="button" onClick={addEntry} disabled={forOther} className="btn-primary">
              Dodaj wpis do dziennika
            </button>
          )}
          <button type="button" onClick={onSaveClick} disabled={saved} className="btn-secondary">
            {saved ? 'Zapisano w historii' : 'Zapisz wynik'}
          </button>
          <button type="button" onClick={() => window.print()} className="btn-secondary">
            Pobierz raport (PDF)
          </button>
          <button type="button" onClick={() => void share()} className="btn-secondary">
            Udostępnij lekarzowi
          </button>
          <button type="button" onClick={onRestart} className="btn-secondary">
            Sprawdź inne objawy
          </button>
        </div>
        {forOther && <p className="mt-3 text-[0.9375rem] text-ink-2">Dziennik jest tylko na Twoje objawy: ocena dla innej osoby do niego nie trafia.</p>}
        {diaryLogin && <p className="mt-3 border border-green/35 bg-green-soft p-3 text-base text-ink">Dziennik jest częścią konta Doco. Zaloguj się, a potem dodaj wpis jeszcze raz.</p>}
        {askLogin && (
          <div className="mt-3 border border-green/35 bg-green-soft p-3 text-base text-ink">
            <p>Zaloguj się, żeby historia była przypisana do Twojego konta i dostępna po ponownym wejściu.</p>
            <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
              <button type="button" onClick={account.signIn} className="btn-primary is-sm">
                Zaloguj się
              </button>
              <button type="button" onClick={save} className="btn-secondary is-sm">
                Zapisz tylko na tym urządzeniu
              </button>
            </div>
          </div>
        )}
        <p className="mt-3 text-sm text-ink-2">Raport możesz pokazać lekarzowi: zawiera objawy, odpowiedzi i możliwe przyczyny. Historia jest zapisywana w tej przeglądarce.</p>
      </section>

      <p className="mt-8 text-sm leading-relaxed text-ink-2">
        {DISCLAIMER} Treści edukacyjne mają charakter ogólny i zostały opracowane na podstawie ogólnodostępnych materiałów dla pacjentów (m.in. NHS, MedlinePlus). Przy każdej wątpliwości skontaktuj się z lekarzem.
      </p>
    </div>
  )
}

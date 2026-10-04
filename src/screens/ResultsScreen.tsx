import { useMemo, useState } from 'react'
import ConditionCard from '../components/ConditionCard.tsx'
import { DISCLAIMER } from '../components/Footer.tsx'
import Steps from '../components/Steps.tsx'
import TriageCard from '../components/TriageCard.tsx'
import { symptomName } from '../data/symptoms.ts'
import { useAccount } from '../lib/account.ts'
import { interviewRedFlags, regionDefIds, regionsSummary, toInput, type CheckDraft } from '../lib/check.ts'
import { addToDiary, openDiary, soleilShell } from '../lib/diary.ts'
import { analyze, TRIAGE_INFO } from '../lib/engine.ts'
import { saveCheck } from '../lib/history.ts'

interface Props {
  draft: CheckDraft
  /** Set when the result was opened from history. */
  savedAt?: string
  onRestart: () => void
  onToast: (message: string) => void
}

const SEX_LABEL = { f: 'kobieta', m: 'mężczyzna' } as const

/**
 * Results in the order every product agrees on: the recommendation first,
 * then possible causes with evidence, then what to do next, then the fine print.
 */
export default function ResultsScreen({ draft, savedAt, onRestart, onToast }: Props) {
  const account = useAccount()
  const result = useMemo(() => analyze(toInput(draft)), [draft])
  const where = regionsSummary(draft)
  const alarms = useMemo(() => interviewRedFlags(draft), [draft])
  const [saved, setSaved] = useState<boolean>(!!savedAt)
  const [askLogin, setAskLogin] = useState(false)
  const symptoms = [...new Set(draft.picks.map((p) => p.symptomId))].map(symptomName)
  const [date] = useState(() => new Date(savedAt ?? Date.now()))

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
    const userId = account.user?.id ?? soleilShell()?.Clerk?.user?.id
    if (!userId) {
      setDiaryLogin(true)
      const shell = soleilShell()
      if (shell?.openAuth) shell.openAuth()
      else account.signIn()
      return
    }
    const ok = addToDiary(userId, {
      at: date.toISOString(),
      where: where || 'Objawy ogólne',
      regions: regionDefIds(draft),
      symptoms,
      level: draft.severity,
      duration: draft.duration,
      onset: draft.onset,
      trend: draft.trend,
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
      `Objawy: ${symptoms.join(', ')}.`,
      `Zalecenie: ${TRIAGE_INFO[result.triage].short}.`,
      result.conditions.length ? `Możliwe przyczyny: ${result.conditions.slice(0, 3).map((c) => c.condition.name).join(', ')}.` : '',
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

  return (
    <div className="mx-auto max-w-3xl px-4 pt-3 pb-6 sm:pb-8 lg:pt-6">
      <Steps current={3} />
      <div className="h-5" />
      <div className="mb-4">
        <p className="eyebrow">Wstępna ocena · {date.toLocaleDateString('pl-PL')}</p>
        <h1 className="mt-1.5 font-serif text-[2rem] leading-tight font-medium tracking-tight text-ink sm:text-[2.5rem]">{where || 'Objawy ogólne'}</h1>
        <p className="mt-2 text-base text-ink-2">
          {draft.forWhom === 'other' ? 'Osoba' : 'Ty'}: {draft.sex ? SEX_LABEL[draft.sex] : '—'}, {draft.age ?? '—'} lat · objawy: {symptoms.join(', ')}
        </p>
        <p className="mt-3 rounded-xl bg-s1 px-4 py-3 text-base text-ink-2">Wynik to wstępna ocena na podstawie Twoich odpowiedzi, a nie diagnoza. O dalszym postępowaniu decyduje lekarz.</p>
      </div>

      <TriageCard triage={result.triage} reasons={result.reasons} />

      <section className="mt-8" aria-labelledby="causes">
        <h2 id="causes" className="font-serif text-[1.75rem] leading-tight font-medium text-ink">
          Możliwe przyczyny
        </h2>
        <p className="mt-1.5 text-base text-ink-2">Uporządkowane według tego, jak dobrze pasują do zgłoszonych objawów. Rozwiń, żeby zobaczyć dlaczego i co możesz zrobić.</p>
        {result.conditions.length === 0 ? (
          <p className="cut mt-4 border border-line bg-s1 p-4 text-base text-ink-2">Za mało danych, żeby wskazać konkretne przyczyny. Dodaj więcej objawów albo skonsultuj się z lekarzem.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {result.conditions.map((item, idx) => (
              <ConditionCard key={item.condition.id} item={item} rank={idx + 1} />
            ))}
          </div>
        )}
      </section>

      {alarms.length > 0 && (
        <section className="cut mt-8 border border-alarm-line bg-alarm-soft p-4 sm:p-5" aria-labelledby="alarms">
          <h2 id="alarms" className="font-serif text-[1.375rem] leading-tight font-medium text-alarm">
            Kiedy pilnie szukać pomocy
          </h2>
          <p className="mt-1.5 text-base text-ink">Jeśli pojawi się którykolwiek z tych objawów, nie czekaj – zadzwoń pod 112 lub 999 albo jedź na SOR.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-ink-2 marker:text-alarm">
            {alarms.map((f) => (
              <li key={f.id}>{f.question.replace(/\?$/, '')}</li>
            ))}
          </ul>
        </section>
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
            <button type="button" onClick={addEntry} className="btn-primary">
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

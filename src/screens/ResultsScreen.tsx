import { useMemo, useState } from 'react'
import ConditionCard from '../components/ConditionCard.tsx'
import { DISCLAIMER } from '../components/Footer.tsx'
import TriageCard from '../components/TriageCard.tsx'
import { symptomName } from '../data/symptoms.ts'
import { useAccount } from '../lib/account.ts'
import { interviewRedFlags, regionsSummary, toInput, type CheckDraft } from '../lib/check.ts'
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
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <div className="mb-4">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Wstępna ocena · {date.toLocaleDateString('pl-PL')}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{where || 'Objawy ogólne'}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {draft.forWhom === 'other' ? 'Osoba' : 'Ty'}: {draft.sex ? SEX_LABEL[draft.sex] : '—'}, {draft.age ?? '—'} lat · objawy: {symptoms.join(', ')}
        </p>
        <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">Wynik to wstępna ocena na podstawie Twoich odpowiedzi, a nie diagnoza. O dalszym postępowaniu decyduje lekarz.</p>
      </div>

      <TriageCard triage={result.triage} reasons={result.reasons} />

      <section className="mt-8" aria-labelledby="causes">
        <h2 id="causes" className="text-xl font-bold text-slate-900">
          Możliwe przyczyny
        </h2>
        <p className="mt-1 text-sm text-slate-600">Uporządkowane według tego, jak dobrze pasują do zgłoszonych objawów. Rozwiń, żeby zobaczyć dlaczego i co możesz zrobić.</p>
        {result.conditions.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Za mało danych, żeby wskazać konkretne przyczyny. Dodaj więcej objawów albo skonsultuj się z lekarzem.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {result.conditions.map((item, idx) => (
              <ConditionCard key={item.condition.id} item={item} rank={idx + 1} />
            ))}
          </div>
        )}
      </section>

      {alarms.length > 0 && (
        <section className="mt-8 rounded-2xl border border-red-200 bg-white p-4 sm:p-5" aria-labelledby="alarms">
          <h2 id="alarms" className="text-lg font-bold text-red-800">
            Kiedy pilnie szukać pomocy
          </h2>
          <p className="mt-1 text-sm text-slate-600">Jeśli pojawi się którykolwiek z tych objawów, nie czekaj – zadzwoń pod 112 lub 999 albo jedź na SOR.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {alarms.map((f) => (
              <li key={f.id}>{f.question.replace(/\?$/, '')}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 print:hidden" aria-labelledby="next">
        <h2 id="next" className="text-lg font-bold text-slate-900">
          Co dalej
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onSaveClick} disabled={saved} className="rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-slate-300">
            {saved ? 'Zapisano w historii' : 'Zapisz wynik'}
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Pobierz raport (PDF)
          </button>
          <button type="button" onClick={() => void share()} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Udostępnij lekarzowi
          </button>
          <button type="button" onClick={onRestart} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Sprawdź inne objawy
          </button>
        </div>
        {askLogin && (
          <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-slate-700">
            <p>Zaloguj się, żeby historia była przypisana do Twojego konta i dostępna po ponownym wejściu.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={account.signIn} className="rounded-full bg-teal-700 px-4 py-1.5 font-semibold text-white hover:bg-teal-800">
                Zaloguj się
              </button>
              <button type="button" onClick={save} className="rounded-full border border-slate-300 bg-white px-4 py-1.5 font-semibold hover:bg-slate-50">
                Zapisz tylko na tym urządzeniu
              </button>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Raport możesz pokazać lekarzowi: zawiera objawy, odpowiedzi i możliwe przyczyny. Historia jest zapisywana w tej przeglądarce.</p>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-slate-500">
        {DISCLAIMER} Treści edukacyjne mają charakter ogólny i zostały opracowane na podstawie ogólnodostępnych materiałów dla pacjentów (m.in. NHS, MedlinePlus). Przy każdej wątpliwości skontaktuj się z lekarzem.
      </p>
    </div>
  )
}

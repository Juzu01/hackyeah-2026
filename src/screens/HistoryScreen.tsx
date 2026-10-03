import { useState } from 'react'
import { CONDITION_BY_ID } from '../data/conditions.ts'
import type { Triage } from '../data/types.ts'
import { useAccount } from '../lib/account.ts'
import { TRIAGE_INFO } from '../lib/engine.ts'
import { loadHistory, removeCheck, type SavedCheck } from '../lib/history.ts'

interface Props {
  onOpen: (item: SavedCheck) => void
}

const DOT: Record<Triage, string> = {
  'self-care': 'bg-care-self',
  gp: 'bg-care-gp',
  urgent: 'bg-care-urgent',
  emergency: 'bg-care-emergency',
}

/** Past checks (date, where, triage colour, top causes), per account. */
export default function HistoryScreen({ onOpen }: Props) {
  const account = useAccount()
  const userId = account.user?.id
  // Re-mounted by App with a key per account, so the initial read is enough.
  const [items, setItems] = useState<SavedCheck[]>(() => loadHistory(userId))

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <h1 className="font-serif text-[2rem] leading-tight font-medium tracking-tight text-ink sm:text-[2.5rem]">Historia analiz</h1>
      <p className="mt-2 text-base text-ink-2">
        {account.status === 'signed-in'
          ? `Analizy zapisane dla konta ${account.user?.name}.`
          : 'Bez logowania historia jest zapisywana tylko w tej przeglądarce. Zaloguj się, żeby przypisać ją do konta.'}
      </p>
      {account.status === 'signed-out' && (
        <button type="button" onClick={account.signIn} className="btn-secondary mt-4">
          Zaloguj się
        </button>
      )}

      {items.length === 0 ? (
        <div className="mt-6 border border-line p-6 text-center text-base text-ink-2">
          <p>Brak zapisanych analiz.</p>
          <a href="#" className="mt-2 inline-flex min-h-11 items-center font-semibold text-green underline-offset-4 hover:underline">
            Sprawdź objawy
          </a>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="cut flex flex-wrap items-start gap-x-3 gap-y-3 border border-line bg-s1 p-4">
              <span className={`mt-2.5 h-2.5 w-2.5 shrink-0 rotate-45 ${DOT[item.triage]}`} aria-hidden="true" />
              <div className="min-w-0 flex-1 basis-56">
                <p className="font-serif text-xl leading-tight font-medium text-ink">{item.where}</p>
                <p className="mt-1 text-[0.9375rem] text-ink-2">
                  {new Date(item.createdAt).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })} · {TRIAGE_INFO[item.triage].title}
                  {item.draft.forWhom === 'other' ? ' · dla kogoś innego' : ''}
                </p>
                {item.topConditions.length > 0 && (
                  <p className="mt-0.5 truncate text-[0.9375rem] text-ink-2">{item.topConditions.map((id) => CONDITION_BY_ID.get(id)?.name ?? id).join(', ')}</p>
                )}
              </div>
              <div className="ml-[1.375rem] flex gap-2 sm:ml-0 sm:self-center">
                <button type="button" onClick={() => onOpen(item)} className="btn-primary is-sm">
                  Otwórz
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeCheck(userId, item.id)
                    setItems(loadHistory(userId))
                  }}
                  className="btn-secondary is-sm"
                >
                  Usuń
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

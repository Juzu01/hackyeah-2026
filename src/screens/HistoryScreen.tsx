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
  'self-care': 'bg-green-600',
  gp: 'bg-blue-600',
  urgent: 'bg-amber-500',
  emergency: 'bg-red-600',
}

/** Past checks (date, where, triage colour, top causes), per account. */
export default function HistoryScreen({ onOpen }: Props) {
  const account = useAccount()
  const userId = account.user?.id
  // Re-mounted by App with a key per account, so the initial read is enough.
  const [items, setItems] = useState<SavedCheck[]>(() => loadHistory(userId))

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Historia analiz</h1>
      <p className="mt-1 text-sm text-slate-600">
        {account.status === 'signed-in'
          ? `Analizy zapisane dla konta ${account.user?.name}.`
          : 'Bez logowania historia jest zapisywana tylko w tej przeglądarce. Zaloguj się, żeby przypisać ją do konta.'}
      </p>
      {account.status === 'signed-out' && (
        <button type="button" onClick={account.signIn} className="mt-3 rounded-full border border-teal-700 px-4 py-1.5 text-sm font-semibold text-teal-800 hover:bg-teal-50">
          Zaloguj się
        </button>
      )}

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center text-sm text-slate-600">
          <p>Brak zapisanych analiz.</p>
          <a href="#" className="mt-2 inline-block font-semibold text-teal-800 hover:underline">
            Sprawdź objawy
          </a>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className={`h-3 w-3 shrink-0 rounded-full ${DOT[item.triage]}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{item.where}</p>
                <p className="text-sm text-slate-600">
                  {new Date(item.createdAt).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })} · {TRIAGE_INFO[item.triage].title}
                  {item.draft.forWhom === 'other' ? ' · dla kogoś innego' : ''}
                </p>
                {item.topConditions.length > 0 && (
                  <p className="mt-0.5 truncate text-sm text-slate-500">{item.topConditions.map((id) => CONDITION_BY_ID.get(id)?.name ?? id).join(', ')}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => onOpen(item)} className="rounded-full bg-teal-700 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-teal-800">
                  Otwórz
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeCheck(userId, item.id)
                    setItems(loadHistory(userId))
                  }}
                  className="rounded-full border border-slate-300 px-3.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
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

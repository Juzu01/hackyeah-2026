import { symptomName } from '../data/symptoms.ts'
import { EVIDENCE_LABEL, TRIAGE_INFO, type RankedCondition } from '../lib/engine.ts'

interface Props {
  item: RankedCondition
  rank: number
}

const BAR: Record<RankedCondition['evidence'], string> = {
  strong: 'bg-teal-600',
  moderate: 'bg-teal-400',
  weak: 'bg-slate-300',
}

/** One possible cause: name, evidence bar + label (Symptomate), "why" and advice (Buoy / Ada). */
export default function ConditionCard({ item, rank }: Props) {
  const { condition: c } = item
  const filled = Math.max(1, Math.round(item.score * 10))
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">{rank}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-snug text-slate-900">{c.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex gap-0.5" role="img" aria-label={`${EVIDENCE_LABEL[item.evidence]}, ${filled} na 10`}>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={`h-2 w-3 rounded-sm ${i < filled ? BAR[item.evidence] : 'bg-slate-100'}`} />
              ))}
            </div>
            <span className="text-sm font-medium text-slate-700">{EVIDENCE_LABEL[item.evidence]}</span>
            <span className="text-xs text-slate-500">zwykle: {TRIAGE_INFO[c.triage].title.toLowerCase()}</span>
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{c.description}</p>
          <details className="mt-2 group">
            <summary className="cursor-pointer text-sm font-medium text-teal-800 hover:underline">Dlaczego to pasuje i co możesz zrobić</summary>
            <div className="mt-2 space-y-3 text-sm text-slate-700">
              <div>
                <p className="font-semibold">Pasujące objawy:</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {item.matched.map((id) => (
                    <span key={id} className="rounded-full bg-teal-50 px-2.5 py-0.5 text-teal-900 ring-1 ring-teal-200">
                      {symptomName(id)}
                    </span>
                  ))}
                </div>
                {item.missing.length > 0 && (
                  <p className="mt-1.5 text-slate-500">
                    Nie zgłoszono typowych objawów: {item.missing.map(symptomName).join(', ').toLowerCase()}.
                  </p>
                )}
              </div>
              <div>
                <p className="font-semibold">Co możesz zrobić:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {c.advice.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
              {c.specialist && (
                <p>
                  <span className="font-semibold">Do kogo:</span> {c.specialist}
                </p>
              )}
            </div>
          </details>
        </div>
      </div>
    </article>
  )
}

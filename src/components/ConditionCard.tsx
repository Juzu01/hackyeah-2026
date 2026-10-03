import { symptomName } from '../data/symptoms.ts'
import { EVIDENCE_LABEL, TRIAGE_INFO, type RankedCondition } from '../lib/engine.ts'

interface Props {
  item: RankedCondition
  rank: number
}

const BAR: Record<RankedCondition['evidence'], string> = {
  strong: 'bg-green',
  moderate: 'bg-green/60',
  weak: 'bg-ink-2',
}

/** One possible cause: name, evidence bar + label (Symptomate), "why" and advice (Buoy / Ada). */
export default function ConditionCard({ item, rank }: Props) {
  const { condition: c } = item
  const filled = Math.max(1, Math.round(item.score * 10))
  return (
    <article className="cut border border-line bg-s1 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-line-2 font-serif text-base text-ink-2">{rank}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-[1.375rem] leading-tight font-medium text-ink">{c.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex gap-0.5" role="img" aria-label={`${EVIDENCE_LABEL[item.evidence]}, ${filled} na 10`}>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={`h-2 w-3 ${i < filled ? BAR[item.evidence] : 'bg-line-2'}`} />
              ))}
            </div>
            <span className="text-[0.9375rem] font-semibold text-ink">{EVIDENCE_LABEL[item.evidence]}</span>
            <span className="text-sm text-ink-2">zwykle: {TRIAGE_INFO[c.triage].title.toLowerCase()}</span>
          </div>
          <p className="mt-2 text-base leading-relaxed text-ink-2">{c.description}</p>
          <details className="group mt-3">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-base font-semibold text-green underline-offset-4 hover:underline">Dlaczego to pasuje i co możesz zrobić</summary>
            <div className="mt-1 space-y-4 border-t border-line pt-3 text-base text-ink-2">
              <div>
                <p className="font-semibold text-ink">Pasujące objawy:</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {item.matched.map((id) => (
                    <span key={id} className="border border-line-2 bg-s2 px-2.5 py-1 text-[0.9375rem] text-ink">
                      {symptomName(id)}
                    </span>
                  ))}
                </div>
                {item.missing.length > 0 && (
                  <p className="mt-2 text-[0.9375rem] text-ink-2">
                    Nie zgłoszono typowych objawów: {item.missing.map(symptomName).join(', ').toLowerCase()}.
                  </p>
                )}
              </div>
              <div>
                <p className="font-semibold text-ink">Co możesz zrobić:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-green">
                  {c.advice.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
              {c.specialist && (
                <p>
                  <span className="font-semibold text-ink">Do kogo:</span> {c.specialist}
                </p>
              )}
            </div>
          </details>
        </div>
      </div>
    </article>
  )
}

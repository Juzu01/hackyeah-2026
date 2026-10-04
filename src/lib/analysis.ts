// "Co mówią Twoje objawy razem": a short reading of all the symptoms together, on top of the
// per-symptom causes. With VITE_ANALYSIS_URL set it comes from Claude behind our own function
// (supabase/functions/analiza-objawow), which gets only the facts below and the causes our
// knowledge base already ranked. Without it, or when the AI doesn't answer in time, it's worked
// out here from the same ranking: which symptoms share a likely cause, which stand apart, and
// which is the most pressing. Only the AI version is labelled as AI.

import { RED_FLAGS } from '../data/redFlags.ts'
import { symptomName } from '../data/symptoms.ts'
import { TRIAGE_LEVELS, type Pregnancy, type Sex, type Triage } from '../data/types.ts'
import { courseSummary, type ForWhom } from './check.ts'
import { EVIDENCE_LABEL, TRIAGE_INFO, type CheckInput, type CheckResult, type RankedCondition, type SymptomResult } from './engine.ts'

export interface Analysis {
  source: 'ai' | 'local'
  /** One or two sentences, always shown. */
  summary: string
  /** Shown when the card is opened. */
  points: { title: string; text: string }[]
}

const URL_: string | undefined = import.meta.env.VITE_ANALYSIS_URL
export const hasAiAnalysis = !!URL_

export const PRIVACY_NOTE = hasAiAnalysis
  ? 'Do analizy AI wysyłamy tylko objawy i odpowiedzi, bez imienia i konta. Reszta zostaje w tej przeglądarce.'
  : 'Twoje odpowiedzi zostają w tej przeglądarce i nie są nigdzie wysyłane.'

interface Context {
  forWhom: ForWhom
  sex?: Sex
  age?: number
  pregnancy?: Pregnancy
}

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
const upperFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const list = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} i ${items[items.length - 1]}`)
const rank = (t: Triage) => TRIAGE_LEVELS.indexOf(t)

/** Worked out from the ranking alone: no network, no AI. */
export function localAnalysis(input: CheckInput, result: CheckResult, bySymptom: SymptomResult[]): Analysis {
  // Lower-case: they go into sentences ("ból głowy i nudności")
  const names = new Map(input.symptoms.map((id) => [id, lowerFirst(symptomName(id))]))
  const points: Analysis['points'] = []

  // Causes that explain two or more of the symptoms, best first; each symptom joins one group.
  const shared: { cause: RankedCondition; symptoms: string[] }[] = []
  const grouped = new Set<string>()
  for (const r of result.conditions) {
    const together = r.matched.filter((id) => names.has(id) && !grouped.has(id))
    if (together.length < 2 || r.evidence === 'weak') continue
    shared.push({ cause: r, symptoms: together })
    for (const id of together) grouped.add(id)
  }
  const apart = input.symptoms.filter((id) => names.has(id) && !grouped.has(id))

  for (const g of shared) {
    points.push({
      title: `${upperFirst(list(g.symptoms.map((id) => names.get(id)!)))}: możliwa wspólna przyczyna`,
      text: `Razem najlepiej pasują do: ${g.cause.condition.name} (${lowerFirst(EVIDENCE_LABEL[g.cause.evidence])}). ${g.cause.condition.description}`,
    })
  }
  if (shared.length && apart.length) {
    points.push({
      title: 'Osobno',
      text: `${upperFirst(list(apart.map((id) => names.get(id)!)))} – ${apart.length > 1 ? 'nie łączą się' : 'nie łączy się'} z pozostałymi objawami w naszej bazie, dlatego ${apart.length > 1 ? 'oceniliśmy je' : 'oceniliśmy go'} osobno.`,
    })
  }

  // The most pressing symptom, when one is more pressing than the rest.
  const [top, second] = [...bySymptom].sort((a, b) => rank(b.triage) - rank(a.triage))
  if (top && second && rank(top.triage) > rank(second.triage)) {
    points.push({
      title: `Najpilniej: ${names.get(top.symptomId)}`,
      text: `${TRIAGE_INFO[top.triage].title} – ${top.reasons.join(', ')}.`,
    })
  }
  const flags = RED_FLAGS.filter((f) => input.redFlags.includes(f.id))
  if (flags.length) points.push({ title: 'Objawy alarmowe', text: `Zgłoszono: ${flags.map((f) => f.reason).join(', ')}. To one decydują o zaleceniu.` })
  if (input.pregnancy === 'yes') points.push({ title: 'Ciąża', text: 'W ciąży każdy niepokojący objaw warto omówić z lekarzem lub położną, nawet jeśli wygląda na łagodny.' })

  const count = bySymptom.length
  const summary =
    count === 1
      ? `Jeden objaw: ${names.get(input.symptoms[0])}. ${TRIAGE_INFO[result.triage].short}.`
      : shared.length
        ? `Część objawów może mieć wspólną przyczynę: ${list(shared[0].symptoms.map((id) => names.get(id)!))}.${apart.length ? ' Pozostałe wyglądają na osobne.' : ''}`
        : `Objawy nie wskazują na jedną wspólną przyczynę, dlatego każdy oceniliśmy osobno.`
  return { source: 'local', summary, points }
}

/** What the AI gets: the person, each symptom with its answers, and the causes our base ranked. Nothing else. */
function payload(ctx: Context, input: CheckInput, result: CheckResult, bySymptom: SymptomResult[]) {
  return {
    osoba: { dla: ctx.forWhom === 'me' ? 'siebie' : 'innej osoby', plec: ctx.sex === 'f' ? 'kobieta' : ctx.sex === 'm' ? 'mężczyzna' : undefined, wiek: ctx.age, ciaza: ctx.pregnancy },
    zalecenie: { poziom: TRIAGE_INFO[result.triage].title, dlaczego: result.reasons },
    objawyAlarmowe: RED_FLAGS.filter((f) => input.redFlags.includes(f.id)).map((f) => f.reason),
    objawy: bySymptom.map((s) => ({
      objaw: symptomName(s.symptomId),
      odpowiedzi: courseSummary(s.course),
      pilnosc: TRIAGE_INFO[s.triage].title,
      mozliwePrzyczyny: s.conditions.map((c) => ({ nazwa: c.condition.name, dopasowanie: EVIDENCE_LABEL[c.evidence], opis: c.condition.description })),
    })),
    przyczynyWspolne: result.conditions.filter((c) => c.matched.length > 1).map((c) => ({ nazwa: c.condition.name, objawy: c.matched.map(symptomName) })),
  }
}

function isAnalysis(x: unknown): x is Omit<Analysis, 'source'> {
  const a = x as Analysis
  return !!a && typeof a.summary === 'string' && Array.isArray(a.points) && a.points.every((p) => typeof p?.title === 'string' && typeof p?.text === 'string')
}

/** The AI's reading when it's set up and answers within the time limit; otherwise ours. */
export async function analyzeTogether(ctx: Context, input: CheckInput, result: CheckResult, bySymptom: SymptomResult[], timeoutMs = 15000): Promise<Analysis> {
  const local = localAnalysis(input, result, bySymptom)
  if (!URL_) return local
  try {
    const res = await fetch(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload(ctx, input, result, bySymptom)),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return local
    const data: unknown = await res.json()
    return isAnalysis(data) ? { source: 'ai', summary: data.summary, points: data.points.slice(0, 6) } : local
  } catch {
    return local
  }
}
